"""delivery/sonos.py — SonosDelivery via SoCo / UPnP"""

import asyncio
import logging

from .base import BaseDelivery

logger = logging.getLogger("delivery")


class SonosDelivery(BaseDelivery):
    """Controls a Sonos speaker via SoCo."""

    def _get_device(self):
        import soco

        devices = list(soco.discover() or [])
        if not devices:
            raise RuntimeError("No Sonos devices found.")
        for d in devices:
            try:
                if d.player_name.lower() == self.target.lower():
                    return d  # Return the actual device; callers handle grouping themselves
            except Exception:
                pass
        available = [d.player_name for d in devices]
        raise RuntimeError(f"Sonos '{self.target}' not found. Available: {available}")

    async def play(self, stream_url: str, title: str = "Connect") -> None:
        device = await asyncio.to_thread(self._get_device)

        # Leave any existing group so we play on this specific device
        try:
            is_coord = await asyncio.to_thread(lambda: device.is_coordinator)
            if not is_coord:
                await asyncio.to_thread(device.unjoin)
                await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning(f"[Sonos:{self.target}] unjoin: {e}")

        info = await asyncio.to_thread(device.get_current_transport_info)
        state = info.get("current_transport_state", "UNKNOWN")
        if state in ("PLAYING", "PAUSED_PLAYBACK", "TRANSITIONING"):
            await asyncio.to_thread(device.stop)

        # DIDL-Lite Metadata
        metadata = (
            '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
            'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
            '<item id="1" parentID="0" restricted="1">'
            f"<dc:title>{title}</dc:title>"
            "<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>"
            f'<res protocolInfo="http-get:*:audio/mpeg:*">{stream_url}</res>'
            "</item>"
            "</DIDL-Lite>"
        )

        logger.info(f"[Sonos:{self.target}] → play: {stream_url}")
        await asyncio.to_thread(
            device.avTransport.SetAVTransportURI,
            [
                ("InstanceID", 0),
                ("CurrentURI", stream_url),
                ("CurrentURIMetaData", metadata),
            ],
        )
        await asyncio.to_thread(
            device.avTransport.Play, [("InstanceID", 0), ("Speed", 1)]
        )
        logger.info(f"[Sonos:{self.target}] ✓ playing")

    async def pause(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.pause)
        logger.info(f"[Sonos:{self.target}] paused")

    async def resume(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.play)
        logger.info(f"[Sonos:{self.target}] resumed")

    async def stop(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.stop)
        logger.info(f"[Sonos:{self.target}] stopped")
