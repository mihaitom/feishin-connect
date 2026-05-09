"""streamer.py — FFmpeg Audio Stream Engine"""

import asyncio
import logging
from collections.abc import AsyncGenerator, Callable

logger = logging.getLogger("connect.streamer")

_FFMPEG_CMD = [
    "ffmpeg",
    "-hide_banner",
    "-loglevel", "warning",   # warning so codec/format issues surface in logs
    "-i", "{url}",
    "-vn",
    "-acodec", "libmp3lame",
    "-ab", "192k",
    "-ar", "44100",
    "-f", "mp3",
    "pipe:1",
]


async def stream_tracks(
    track_urls: list[str],
    on_track_start: Callable[[int], None] | None = None,
) -> AsyncGenerator[bytes, None]:
    """Yield continuous MP3 bytes for all tracks in sequence.

    Calls on_track_start(relative_index) before each track begins.
    """
    if not track_urls:
        return

    for i, url in enumerate(track_urls):
        if on_track_start:
            on_track_start(i)

        cmd = [arg if arg != "{url}" else url for arg in _FFMPEG_CMD]
        logger.info(f"[ffmpeg] Track {i + 1}/{len(track_urls)}: {url[:80]}")
        logger.debug(f"[ffmpeg] Befehl: {' '.join(cmd)}")

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Read stderr concurrently to prevent pipe buffer deadlock
            stderr_task = asyncio.create_task(proc.stderr.read())

            while True:
                chunk = await proc.stdout.read(8192)
                if not chunk:
                    break
                yield chunk

            await proc.wait()
            stderr = await stderr_task

            if proc.returncode != 0:
                logger.warning(
                    f"[ffmpeg] Track {i + 1} exit {proc.returncode}: "
                    f"{stderr.decode(errors='replace')[:400]}"
                )
            elif stderr:
                logger.debug(f"[ffmpeg] Track {i + 1} stderr: {stderr.decode(errors='replace')[:200]}")

        except FileNotFoundError:
            logger.error("[ffmpeg] ❌ ffmpeg nicht gefunden — bitte installieren (apk add ffmpeg)")
            return

        except asyncio.CancelledError:
            logger.info(f"[ffmpeg] Stream abgebrochen (Track {i + 1})")
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass
            return

        except Exception as e:
            logger.error(f"[ffmpeg] Fehler Track {i + 1}: {e}", exc_info=True)
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass
            continue

    logger.info("[ffmpeg] Alle Tracks gestreamt")
