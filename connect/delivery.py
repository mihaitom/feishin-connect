"""
delivery.py — Audio Delivery Abstraction

Unterstützt mehrere Renderer gleichzeitig:
  - Sonos   (via SoCo / UPnP)
  - AirPlay (via pyatv)

Konfiguration in .env:
  TARGETS=sonos:Arbeitszimmer,airplay:HomePod Küche
"""

import asyncio
import io
import logging
import os
from abc import ABC, abstractmethod

logger = logging.getLogger("delivery")


# ──────────────────────────────────────────────
# Base
# ──────────────────────────────────────────────

class BaseDelivery(ABC):
    def __init__(self, target: str):
        self.target = target

    @abstractmethod
    async def play(self, stream_url: str, title: str = "Connect") -> None:
        """Startet Wiedergabe des Streams."""

    @abstractmethod
    async def stop(self) -> None:
        """Stoppt Wiedergabe."""

    async def pause(self) -> None:
        """Pausiert Wiedergabe (optional, Standard: no-op)."""

    async def resume(self) -> None:
        """Setzt Wiedergabe fort (optional, Standard: no-op)."""

    def __repr__(self):
        return f"{self.__class__.__name__}({self.target})"


# ──────────────────────────────────────────────
# Sonos
# ──────────────────────────────────────────────

class SonosDelivery(BaseDelivery):
    """Steuert einen Sonos-Lautsprecher via SoCo."""

    def _get_device(self):
        import soco
        devices = list(soco.discover() or [])
        if not devices:
            raise RuntimeError("Keine Sonos-Geräte gefunden.")
        for d in devices:
            try:
                if d.player_name.lower() == self.target.lower():
                    return d  # Return the actual device; callers handle grouping themselves
            except Exception:
                pass
        available = [d.player_name for d in devices]
        raise RuntimeError(f"Sonos '{self.target}' nicht gefunden. Verfügbar: {available}")

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
            f'<dc:title>{title}</dc:title>'
            '<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>'
            f'<res protocolInfo="http-get:*:audio/mpeg:*">{stream_url}</res>'
            '</item>'
            '</DIDL-Lite>'
        )

        logger.info(f"[Sonos:{self.target}] → play: {stream_url}")
        await asyncio.to_thread(
            device.avTransport.SetAVTransportURI,
            [("InstanceID", 0), ("CurrentURI", stream_url), ("CurrentURIMetaData", metadata)]
        )
        await asyncio.to_thread(
            device.avTransport.Play,
            [("InstanceID", 0), ("Speed", 1)]
        )
        logger.info(f"[Sonos:{self.target}] ✓ spielt")

    async def pause(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.pause)
        logger.info(f"[Sonos:{self.target}] pausiert")

    async def resume(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.play)
        logger.info(f"[Sonos:{self.target}] fortgesetzt")

    async def stop(self) -> None:
        device = await asyncio.to_thread(self._get_device)
        await asyncio.to_thread(device.stop)
        logger.info(f"[Sonos:{self.target}] gestoppt")


# ──────────────────────────────────────────────
# AirPlay
# ──────────────────────────────────────────────

class AirPlayDelivery(BaseDelivery):
    """
    Streamt Audio zu einem AirPlay-Gerät via pyatv.

    pip install pyatv

    Wichtig: pyatv pushed den Stream aktiv (anders als Sonos der pulled).
    Der Stream-Task läuft im Hintergrund bis stop() aufgerufen wird.
    """

    def __init__(self, target: str):
        super().__init__(target)
        self._stream_task: asyncio.Task | None = None
        self._atv = None

    async def _find_device(self):
        import pyatv
        logger.info(f"[AirPlay:{self.target}] Suche Gerät...")
        devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
        for d in devices:
            if d.name.lower() == self.target.lower():
                logger.info(f"[AirPlay:{self.target}] Gefunden: {d.address}")
                return d
        available = [d.name for d in devices]
        raise RuntimeError(
            f"AirPlay '{self.target}' nicht gefunden. "
            f"Verfügbar: {available}"
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

        await self.stop()

        conf = await self._find_device()
        loop = asyncio.get_event_loop()
        self._atv = await pyatv.connect(conf, loop)

        logger.info(f"[AirPlay:{self.target}] → stream: {stream_url}")

        async def _stream():
            pipe_r, pipe_w = os.pipe()
            proc = None
            try:
                # ffmpeg transcodes the HTTP MP3 stream → 16-bit PCM WAV.
                # OS pipe (not proc.stdout/asyncio.StreamReader): pyatv calls
                # readframes() synchronously from the event loop thread via
                # next(miniaudio_generator), which would deadlock with
                # StreamReader's run_coroutine_threadsafe. An OS pipe read is
                # kernel-level and independent of the asyncio event loop.
                # -err_detect ignore_err suppresses MP3 frame errors from the
                # /stream feed during encoder warm-up / track boundaries.
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-err_detect", "ignore_err",
                    "-i", stream_url,
                    "-vn",
                    "-acodec", "pcm_s16le",
                    "-ar", "44100",
                    "-ac", "2",
                    "-f", "wav",
                    f"pipe:{pipe_w}",
                    pass_fds=(pipe_w,),
                )
                os.close(pipe_w)

                with open(pipe_r, "rb") as raw:
                    await self._atv.stream.stream_file(io.BufferedReader(raw))

                await proc.wait()
                logger.info(f"[AirPlay:{self.target}] Stream beendet")

            except asyncio.CancelledError:
                logger.info(f"[AirPlay:{self.target}] Stream abgebrochen")
                if proc:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                try:
                    os.close(pipe_r)
                except Exception:
                    pass

            except Exception as e:
                logger.error(f"[AirPlay:{self.target}] Fehler: {e}")
                if proc:
                    try:
                        proc.kill()
                    except Exception:
                        pass

            finally:
                atv, self._atv = self._atv, None
                if atv:
                    # asyncio.shield keeps the close tasks alive even when this
                    # task is in a cancelled state (CancelledError is still
                    # propagated, but the cleanup completes first).
                    try:
                        await asyncio.shield(self._close_atv(atv))
                    except asyncio.CancelledError:
                        pass

        self._stream_task = asyncio.create_task(_stream())
        logger.info(f"[AirPlay:{self.target}] ✓ Stream-Task gestartet")

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
        logger.info(f"[AirPlay:{self.target}] gestoppt")


# ──────────────────────────────────────────────
# Delivery Manager
# ──────────────────────────────────────────────

class DeliveryManager:
    """
    Verwaltet mehrere Delivery-Targets gleichzeitig.

    Konfiguration via TARGETS env var:
      TARGETS=sonos:Arbeitszimmer,airplay:HomePod Küche,sonos:Wohnzimmer
    """

    def __init__(self, targets_config: str):
        self.deliveries = self._parse(targets_config)
        if self.deliveries:
            logger.info(f"Delivery Targets: {self.deliveries}")
        else:
            logger.warning("Keine TARGETS konfiguriert — nur /stream endpoint verfügbar")

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
                logger.warning(f"Ungültiger Target-Eintrag (Format: 'typ:name'): {entry}")
                continue
            typ, name = entry.split(":", 1)
            typ = typ.strip().lower()
            name = name.strip()
            if typ == "sonos":
                result.append(SonosDelivery(name))
            elif typ == "airplay":
                result.append(AirPlayDelivery(name))
            else:
                logger.warning(f"Unbekannter Delivery-Typ: '{typ}' (bekannt: sonos, airplay)")
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
                logger.error(f"Delivery Fehler: {result}")

    async def _play_grouped_sonos(
        self, deliveries: list[SonosDelivery], stream_url: str, title: str
    ) -> None:
        """Group Sonos devices so they play in sync (coordinator + followers)."""
        devices = await asyncio.gather(*[asyncio.to_thread(d._get_device) for d in deliveries])
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
        await asyncio.gather(*[d.pause() for d in self.deliveries], return_exceptions=True)

    async def resume(self) -> None:
        await asyncio.gather(*[d.resume() for d in self.deliveries], return_exceptions=True)

    async def stop(self) -> None:
        await asyncio.gather(*[d.stop() for d in self.deliveries], return_exceptions=True)

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
    """Findet alle Sonos-Geräte im Netzwerk."""
    import soco
    devices = await asyncio.to_thread(lambda: list(soco.discover() or []))
    return [{"name": d.player_name, "ip": d.ip_address} for d in devices]


async def discover_airplay() -> list[dict]:
    """Findet alle AirPlay-Geräte im Netzwerk."""
    import pyatv
    devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
    return [
        {"name": d.name, "address": str(d.address), "model": str(d.device_info.model)}
        for d in devices
    ]