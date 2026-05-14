"""
delivery.py — Audio Delivery Abstraction

Supports multiple renderers simultaneously:
  - Sonos   (via SoCo / UPnP)
  - AirPlay (via pyatv)

Configuration in .env:
  TARGETS=sonos:Arbeitszimmer,airplay:HomePod Küche
"""

import asyncio
import io
import logging
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger("delivery")


# ──────────────────────────────────────────────
# Base
# ──────────────────────────────────────────────


class BaseDelivery(ABC):
    def __init__(self, target: str):
        self.target = target

    @abstractmethod
    async def play(self, stream_url: str, title: str = "Connect") -> None:
        """Start stream playback."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop playback."""

    async def pause(self) -> None:
        """Pause playback (optional, default: no-op)."""

    async def resume(self) -> None:
        """Resume playback (optional, default: no-op)."""

    def __repr__(self):
        return f"{self.__class__.__name__}({self.target})"


# ──────────────────────────────────────────────
# Sonos
# ──────────────────────────────────────────────


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


# ──────────────────────────────────────────────
# AirPlay
# ──────────────────────────────────────────────


class AirPlayDelivery(BaseDelivery):
    """
    Streams audio to an AirPlay device via pyatv.

    pip install pyatv

    Important: pyatv pushes the stream actively (unlike Sonos which pulls).
    The stream task runs in the background until stop() is called.
    """

    def __init__(self, target: str):
        super().__init__(target)
        self._stream_task: asyncio.Task | None = None
        self._atv = None
        self._play_lock = asyncio.Lock()

    async def _find_device(self):
        import pyatv
        from pyatv.const import Protocol
        import credentials as creds_store

        stored_creds = creds_store.get(self.target)

        if stored_creds:
            # AirPlay 2: full scan, set HAP credentials (Protocol.AirPlay)
            logger.info(
                f"[AirPlay:{self.target}] Scanning for device (AirPlay 2, paired)..."
            )
            devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
            for d in devices:
                if d.name.lower() == self.target.lower():
                    d.set_credentials(Protocol.AirPlay, stored_creds)
                    logger.info(
                        f"[AirPlay:{self.target}] Found: {d.address} (AirPlay 2)"
                    )
                    return d
            available = [d.name for d in devices]
            raise RuntimeError(
                f"AirPlay '{self.target}' not found. Available: {available}"
            )
        else:
            # AirPlay 1 / RAOP: no pairing needed
            logger.info(
                f"[AirPlay:{self.target}] Scanning for device (RAOP, unpaired)..."
            )
            devices = await pyatv.scan(
                asyncio.get_event_loop(), protocol=Protocol.RAOP, timeout=10
            )
            for d in devices:
                if d.name.lower() == self.target.lower():
                    logger.info(f"[AirPlay:{self.target}] Found: {d.address} (RAOP)")
                    return d
            available = [d.name for d in devices]
            raise RuntimeError(
                f"AirPlay '{self.target}' not found via RAOP. Available: {available}"
            )

    @staticmethod
    async def _close_atv(atv) -> None:
        """Await all tasks returned by atv.close() so the aiohttp session is
        properly torn down before the next connect() call."""
        tasks = atv.close()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def play(self, stream_url: str, title: str = "Connect") -> None:
        import pyatv

        async with self._play_lock:
            await self.stop()

            conf = await self._find_device()
            loop = asyncio.get_event_loop()
            self._atv = await pyatv.connect(conf, loop)

        logger.info(
            f"[AirPlay:{self.target}] connected — '{title}' (backend: {stream_url})"
        )

        # Capture connection at task-creation time so the finally block closes
        # exactly this instance, even if self._atv is replaced by a concurrent play() call.
        captured_atv = self._atv

        async def _stream():
            # Lazy import — state.py imports delivery.py, so no top-level import possible
            from state import ctx

            try:
                tracks = list(ctx.state.current_tracks)
                if not tracks or not ctx.navidrome:
                    logger.warning(
                        f"[AirPlay:{self.target}] No tracks or Navidrome not configured"
                    )
                    return

                # miniaudio (internal to pyatv) needs complete audio data before the
                # decoder can start. Prefetch: download the next track in the background
                # while the current one plays → no silence between tracks.
                async with httpx.AsyncClient(
                    follow_redirects=True, timeout=600.0
                ) as http:

                    async def fetch(url: str) -> io.BytesIO:
                        resp = await http.get(url)
                        resp.raise_for_status()
                        logger.info(
                            f"[AirPlay:{self.target}] ↓ {len(resp.content):,} bytes: {url.split('id=')[1][:8]}…"
                        )
                        return io.BytesIO(resp.content)

                    # Preload first track
                    prefetched = await fetch(ctx.navidrome.get_stream_url(tracks[0].id))
                    next_task: asyncio.Task | None = None

                    for idx, track in enumerate(tracks):
                        # Start prefetching next track in background while current plays
                        next_task = None
                        if idx + 1 < len(tracks):
                            next_url = ctx.navidrome.get_stream_url(tracks[idx + 1].id)
                            next_task = asyncio.create_task(fetch(next_url))

                        logger.info(
                            f"[AirPlay:{self.target}] ▶ [{idx + 1}/{len(tracks)}] {track.title}"
                        )
                        await captured_atv.stream.stream_file(prefetched)
                        logger.info(f"[AirPlay:{self.target}] ✓ sent")

                        if next_task:
                            prefetched = await next_task

                logger.info(f"[AirPlay:{self.target}] Queue finished")

            except asyncio.CancelledError:
                if next_task and not next_task.done():
                    next_task.cancel()
                logger.info(f"[AirPlay:{self.target}] Stream cancelled")

            except Exception as e:
                logger.error(f"[AirPlay:{self.target}] Error: {e}", exc_info=True)

            finally:
                if self._atv is captured_atv:
                    self._atv = None
                try:
                    await asyncio.shield(self._close_atv(captured_atv))
                except asyncio.CancelledError:
                    pass

        self._stream_task = asyncio.create_task(_stream())
        logger.info(f"[AirPlay:{self.target}] ✓ stream task started")

    async def stop(self) -> None:
        if self._stream_task and not self._stream_task.done():
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
        # _stream()'s finally already closes _atv when the task exits normally
        # or on cancellation. This handles the edge case where stop() is called
        # without an active stream task (e.g. connect failed after _atv was set).
        atv, self._atv = self._atv, None
        if atv:
            await self._close_atv(atv)
        logger.info(f"[AirPlay:{self.target}] stopped")


# ──────────────────────────────────────────────
# Delivery Manager
# ──────────────────────────────────────────────


class DeliveryManager:
    """
    Manages multiple delivery targets simultaneously.

    Configuration via TARGETS env var:
      TARGETS=sonos:Arbeitszimmer,airplay:HomePod Küche,sonos:Wohnzimmer
    """

    def __init__(self, targets_config: str):
        self.deliveries = self._parse(targets_config)
        if self.deliveries:
            logger.info(f"Delivery Targets: {self.deliveries}")
        else:
            logger.warning("No TARGETS configured — only /stream endpoint available")

    @classmethod
    def from_deliveries(cls, deliveries: list[BaseDelivery]) -> "DeliveryManager":
        """Create a manager from an explicit list of delivery objects (e.g. for multiroom)."""
        instance = cls.__new__(cls)
        instance.deliveries = deliveries
        return instance

    def _parse(self, config: str) -> list[BaseDelivery]:
        if not config or not config.strip():
            return []
        result = []
        for entry in config.split(","):
            entry = entry.strip()
            if ":" not in entry:
                logger.warning(f"Invalid target entry (format: 'type:name'): {entry}")
                continue
            typ, name = entry.split(":", 1)
            typ = typ.strip().lower()
            name = name.strip()
            if typ == "sonos":
                result.append(SonosDelivery(name))
            elif typ == "airplay":
                result.append(AirPlayDelivery(name))
            else:
                logger.warning(
                    f"Unknown delivery type: '{typ}' (known: sonos, airplay)"
                )
        return result

    async def play(self, stream_url: str, title: str = "Connect") -> None:
        if not self.deliveries:
            return
        sonos = [d for d in self.deliveries if isinstance(d, SonosDelivery)]
        others = [d for d in self.deliveries if not isinstance(d, SonosDelivery)]

        tasks = []
        if len(sonos) > 1:
            tasks.append(self._play_grouped_sonos(sonos, stream_url, title))
        elif sonos:
            tasks.append(sonos[0].play(stream_url, title))
        tasks.extend(d.play(stream_url, title) for d in others)

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Delivery error: {result}")

    async def _play_grouped_sonos(
        self, deliveries: list[SonosDelivery], stream_url: str, title: str
    ) -> None:
        """Group Sonos devices so they play in sync (coordinator + followers)."""
        devices = await asyncio.gather(
            *[asyncio.to_thread(d._get_device) for d in deliveries]
        )
        coordinator, followers = devices[0], devices[1:]

        for f in followers:
            try:
                await asyncio.to_thread(f.unjoin)
            except Exception as e:
                logger.warning(f"[Sonos group] unjoin: {e}")

        await asyncio.sleep(0.5)

        for f in followers:
            try:
                await asyncio.to_thread(f.join, coordinator)
            except Exception as e:
                logger.warning(f"[Sonos group] join: {e}")

        await asyncio.sleep(0.5)

        await deliveries[0].play(stream_url, title)

    async def pause(self) -> None:
        await asyncio.gather(
            *[d.pause() for d in self.deliveries], return_exceptions=True
        )

    async def resume(self) -> None:
        await asyncio.gather(
            *[d.resume() for d in self.deliveries], return_exceptions=True
        )

    async def stop(self) -> None:
        await asyncio.gather(
            *[d.stop() for d in self.deliveries], return_exceptions=True
        )

    async def play_all(self, stream_url: str, title: str = "Connect") -> None:
        await self.play(stream_url, title)

    async def stop_all(self) -> None:
        await self.stop()

    def list_targets(self) -> list[dict]:
        return [
            {"type": type(d).__name__.replace("Delivery", "").lower(), "name": d.target}
            for d in self.deliveries
        ]


# ──────────────────────────────────────────────
# Discovery Helpers
# ──────────────────────────────────────────────


async def discover_sonos() -> list[dict]:
    """Discovers all Sonos devices on the network."""
    import soco

    devices = await asyncio.to_thread(lambda: list(soco.discover() or []))
    return [{"name": d.player_name, "ip": d.ip_address} for d in devices]


async def discover_airplay() -> list[dict]:
    """Discovers all AirPlay devices on the network."""
    import pyatv
    from pyatv.const import Protocol

    devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
    result = []
    for d in devices:
        protocols = {s.protocol for s in d.services}
        result.append(
            {
                "address": str(d.address),
                "model": str(d.device_info.model),
                "name": d.name,
                # AirPlay 2 devices expose Protocol.AirPlay (HAP-based) and require pairing.
                # AirPlay 1 / RAOP devices do not.
                "needs_pairing": Protocol.AirPlay in protocols,
            }
        )
    return result
