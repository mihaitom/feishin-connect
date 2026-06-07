"""delivery/airplay.py — AirPlayDelivery via pyatv"""

import asyncio
import io
import logging

import httpx

from . import credentials as creds_store
from .base import BaseDelivery

logger = logging.getLogger("delivery")


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
        # Lazy import: state.py imports delivery, so top-level import would be circular
        from state import ctx

        stored_creds = creds_store.get(self.target)
        loop = asyncio.get_event_loop()
        # Unpaired devices must be scanned via RAOP; paired AirPlay 2 devices
        # need a full-protocol scan so the AirPlay (HAP) service is exposed.
        protocol = None if stored_creds else Protocol.RAOP
        kind = "AirPlay 2, paired" if stored_creds else "RAOP, unpaired"

        # Fast path: a targeted unicast scan to the IP from the last discovery
        # returns as soon as the device replies (~ms), avoiding the full ~10s
        # mDNS sweep on every play. Falls back to a full scan if the cached IP
        # is missing or stale.
        cached = next(
            (
                d
                for d in ctx.state.discovered.get("airplay", [])
                if d.get("name", "").lower() == self.target.lower() and d.get("address")
            ),
            None,
        )
        host = cached["address"] if cached else None

        async def _scan(hosts, timeout):
            logger.info(
                f"[AirPlay:{self.target}] Scanning ({kind}"
                f"{f', {hosts[0]}' if hosts else ', full'})..."
            )
            devices = await pyatv.scan(
                loop, timeout=timeout, protocol=protocol, hosts=hosts
            )
            return next(
                (d for d in devices if d.name.lower() == self.target.lower()), None
            ), devices

        match, devices = (await _scan([host], 5)) if host else (None, [])
        if match is None:
            match, devices = await _scan(None, 10)

        if match is None:
            available = [d.name for d in devices]
            raise RuntimeError(
                f"AirPlay '{self.target}' not found. Available: {available}"
            )

        if stored_creds:
            # AirPlay 2 pairing yields HAP credentials valid for both protocols.
            # The audio is streamed via RAOP, so the RAOP service needs the
            # credentials too — otherwise pyatv sets up an unencrypted session
            # and the device refuses the audio data port (Connection refused).
            match.set_credentials(Protocol.AirPlay, stored_creds)
            has_raop = match.set_credentials(Protocol.RAOP, stored_creds)
            logger.info(
                f"[AirPlay:{self.target}] Found: {match.address} "
                f"({kind}, raop_creds={has_raop})"
            )
        else:
            logger.info(f"[AirPlay:{self.target}] Found: {match.address} ({kind})")
        return match

    @staticmethod
    async def _close_atv(atv) -> None:
        """Await all tasks returned by atv.close() so the aiohttp session is
        properly torn down before the next connect() call."""
        tasks = atv.close()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    async def _fetch_audio(src_url: str, offset: float) -> io.BytesIO:
        """Download audio from src_url. If offset > 0, use ffmpeg to seek before
        passing the bytes to pyatv — otherwise download the file directly."""
        if offset > 0:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y",
                "-ss", str(offset),
                "-i", src_url,
                "-vn", "-acodec", "mp3", "-f", "mp3", "pipe:1",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            data, _ = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"ffmpeg seek failed (exit {proc.returncode})")
            return io.BytesIO(data)

        async with httpx.AsyncClient(follow_redirects=True, timeout=600.0) as http:
            resp = await http.get(src_url)
            resp.raise_for_status()
            return io.BytesIO(resp.content)

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
            from state import ctx

            try:
                track = ctx.state.current_track

                if not track:
                    # Radio / live URL — pass directly to pyatv (no BytesIO needed)
                    if not stream_url:
                        logger.warning(f"[AirPlay:{self.target}] No track and no stream URL")
                        return
                    logger.info(f"[AirPlay:{self.target}] ▶ radio: {stream_url[:80]}")
                    await captured_atv.stream.stream_file(stream_url)
                    logger.info(f"[AirPlay:{self.target}] ✓ radio stream ended")
                    return

                if not ctx.media:
                    logger.warning(f"[AirPlay:{self.target}] No media server configured")
                    return

                offset = ctx.state.resume_offset
                src_url = ctx.media.get_stream_url(track.id)

                if offset > 0:
                    logger.info(
                        f"[AirPlay:{self.target}] ↓ seeking to {offset:.1f}s: {track.title}"
                    )
                else:
                    logger.info(
                        f"[AirPlay:{self.target}] ↓ downloading: {track.title}"
                    )

                audio = await AirPlayDelivery._fetch_audio(src_url, offset)
                logger.info(f"[AirPlay:{self.target}] ▶ {track.title}")
                await captured_atv.stream.stream_file(audio)
                logger.info(f"[AirPlay:{self.target}] ✓ sent")

            except asyncio.CancelledError:
                logger.info(f"[AirPlay:{self.target}] Stream cancelled")

            except Exception as e:
                if "not connected to remote" in str(e):
                    # Teardown noise: Apple TV dropped the connection; the actual
                    # cause (e.g. "Connection refused") is already logged by pyatv above.
                    logger.warning(f"[AirPlay:{self.target}] Device disconnected during stream")
                else:
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
