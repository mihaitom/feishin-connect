"""delivery/dlna.py — DlnaDelivery via async-upnp-client (UPnP/DLNA MediaRenderer)

Unlike Sonos/Chromecast, DLNA has no vendor SDK or persistent device browser —
each device is a generic UPnP MediaRenderer reached via its own SOAP control
URLs (AVTransport for play/stop/position, RenderingControl for volume), found
via SSDP. `async-upnp-client`'s `DmrDevice` profile wraps that SOAP surface
with plain async methods, so this stays about as small as chromecast.py.
"""

import logging

from .base import BaseDelivery

logger = logging.getLogger("delivery")

# DLNA has no persistent discovery browser to query for a device's current
# location (unlike Sonos' soco.discover() or Chromecast's CastBrowser cache),
# so we keep our own: name -> description-XML URL, populated by discover_dlna()
# and consulted by _get_device() when a delivery is constructed directly
# (e.g. from the TARGETS env var) rather than from a fresh /discover call.
_location_cache: dict[str, str] = {}
_device_cache: dict = {}


async def _create_dmr_device(location: str):
    from async_upnp_client.aiohttp import AiohttpRequester
    from async_upnp_client.client_factory import UpnpFactory
    from async_upnp_client.profiles.dlna import DmrDevice

    requester = AiohttpRequester()
    factory = UpnpFactory(requester)
    upnp_device = await factory.async_create_device(location)
    return DmrDevice(upnp_device, event_handler=None)


class DlnaDelivery(BaseDelivery):
    """Controls a DLNA/UPnP MediaRenderer device via async-upnp-client."""

    SUPPORTS_POSITION: bool = True

    async def _get_device(self):
        cached = _device_cache.get(self.target.lower())
        if cached is not None:
            return cached

        location = _location_cache.get(self.target.lower())
        if not location:
            # No cached location (e.g. delivery built straight from TARGETS) —
            # do a fresh scan to resolve one. Imported locally: discover_dlna
            # lives in manager.py, which itself imports from this module.
            from .manager import discover_dlna

            for d in await discover_dlna():
                if d["name"].lower() == self.target.lower():
                    location = d["location"]
                    break
        if not location:
            raise RuntimeError(f"DLNA device '{self.target}' not found")

        device = await _create_dmr_device(location)
        await device.async_update()
        _device_cache[self.target.lower()] = device
        return device

    async def _get_device_or_evict(self):
        try:
            return await self._get_device()
        except Exception:
            _device_cache.pop(self.target.lower(), None)
            raise

    async def play(
        self,
        stream_url: str,
        title: str = "Connect",
        artist: str = "",
        album_art_url: str | None = None,
    ) -> None:
        device = await self._get_device_or_evict()
        meta_data = {"artist": artist} if artist else None
        logger.info(f"[DLNA:{self.target}] → play: {stream_url}")
        try:
            await device.async_set_transport_uri(stream_url, title, meta_data)
            await device.async_play()
        except Exception:
            _device_cache.pop(self.target.lower(), None)
            raise
        logger.info(f"[DLNA:{self.target}] ✓ playing")

    async def pause(self) -> None:
        device = await self._get_device_or_evict()
        await device.async_pause()
        logger.info(f"[DLNA:{self.target}] paused")

    async def resume(self) -> None:
        device = await self._get_device_or_evict()
        await device.async_play()
        logger.info(f"[DLNA:{self.target}] resumed")

    async def stop(self) -> None:
        device = await self._get_device_or_evict()
        await device.async_stop()
        logger.info(f"[DLNA:{self.target}] stopped")

    async def get_position(self) -> float | None:
        device = await self._get_device_or_evict()
        await device.async_update(do_ping=False)
        position = device.media_position
        return float(position) if position is not None else None

    async def get_volume(self) -> float | None:
        device = await self._get_device_or_evict()
        await device.async_update(do_ping=False)
        level = device.volume_level
        return round(level * 100) if level is not None else None

    async def set_volume(self, volume: float) -> None:
        device = await self._get_device_or_evict()
        await device.async_set_volume_level(max(0.0, min(1.0, volume / 100.0)))
