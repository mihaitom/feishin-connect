"""
streamer.py — FFmpeg Audio Stream Engine
"""

import asyncio
import logging
from collections.abc import AsyncGenerator, Callable

logger = logging.getLogger("streamer")


async def stream_tracks(
    track_urls: list[str],
    on_track_start: Callable[[int], None] | None = None,
) -> AsyncGenerator[bytes, None]:
    """
    Yields continuous MP3 bytes for all tracks in sequence.
    Calls on_track_start(relative_index) before each track begins.
    """
    if not track_urls:
        return

    for i, url in enumerate(track_urls):
        if on_track_start:
            on_track_start(i)

        logger.info(f"Streaming track {i + 1}/{len(track_urls)}: {url[:60]}...")

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-hide_banner",
                "-loglevel", "error",
                "-i", url,
                "-vn",
                "-acodec", "libmp3lame",
                "-ab", "192k",
                "-ar", "44100",
                "-f", "mp3",
                "pipe:1",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            while True:
                chunk = await proc.stdout.read(4096)
                if not chunk:
                    break
                yield chunk

            await proc.wait()

            if proc.returncode != 0:
                stderr = await proc.stderr.read()
                logger.warning(f"FFmpeg exit {proc.returncode}: {stderr.decode()[:200]}")

        except asyncio.CancelledError:
            logger.info("Stream cancelled — killing FFmpeg")
            try:
                proc.kill()
            except Exception:
                pass
            return

        except Exception as e:
            logger.error(f"FFmpeg error on track {i + 1}: {e}")
            continue

    logger.info("All tracks streamed.")
