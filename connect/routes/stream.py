"""routes/stream.py — GET /stream, GET /status, GET /events"""

import asyncio
import json
import logging
import time

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

from state import build_status_dict, ctx, event_bus
from streamer import stream_tracks

logger = logging.getLogger("connect.stream")
router = APIRouter()


@router.head("/stream")
async def audio_stream_head():
    """ffmpeg probes the URL with HEAD before streaming — answer without starting ffmpeg."""
    return Response(
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/stream")
async def audio_stream():
    if not ctx.state.current_track:
        logger.warning("[stream] No track loaded — returning 204")
        return StreamingResponse(iter([b""]), media_type="audio/mpeg", status_code=204)

    track = ctx.state.current_track
    track_url = ctx.navidrome.get_stream_url(track.id)

    # Consume the resume offset (set by /pause, applied once on reconnect via FFmpeg -ss)
    offset = ctx.state.resume_offset
    ctx.state.resume_offset = 0.0

    logger.info(
        f"[stream] Client connected — {track.artist} — {track.title}"
        + (f" (seek {offset:.1f}s)" if offset > 0.5 else "")
    )

    def on_track_start(_: int) -> None:
        logger.info(f"[stream] ▶ {track.artist} — {track.title} ({track.duration}s)")

    async def _fire_track_end(my_generation: int, wait: float) -> None:
        """Fires track-end signal after waiting for Sonos to finish playback.

        Runs as an independent task so Sonos closing the HTTP connection cannot
        cancel it (that CancelledError would only affect stream_with_completion).
        """
        if wait > 0.5:
            logger.info(f"[stream] FFmpeg done early — waiting {wait:.1f}s for playback to finish")
            await asyncio.sleep(wait)
        st = ctx.state
        if st.is_streaming and not st.is_paused and st.play_generation == my_generation:
            logger.info("[stream] Track finished — marking stream complete")
            st.is_streaming = False
            st.track_ended = True
            await event_bus.broadcast()

    async def stream_with_completion():
        my_generation = ctx.state.play_generation
        try:
            async for chunk in stream_tracks(
                [track_url], on_track_start=on_track_start, start_offset=offset
            ):
                yield chunk
        except asyncio.CancelledError:
            raise  # client disconnected mid-stream — not a natural end

        # FFmpeg may stream faster than real-time because Sonos buffers aggressively.
        # Schedule completion in an independent task so Sonos closing the connection
        # after receiving all data doesn't cancel the track-end signal.
        st = ctx.state
        if st.is_streaming and not st.is_paused and st.play_generation == my_generation:
            wait = 0.0
            if st.current_track and st.play_start_time:
                wait = max(0.0, (st.play_start_time + st.current_track.duration) - time.time())
            asyncio.create_task(_fire_track_end(my_generation, wait))

    return StreamingResponse(
        stream_with_completion(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/status")
async def status():
    return build_status_dict()


@router.get("/events")
async def status_events():
    queue = event_bus.subscribe()

    async def generator():
        try:
            yield "retry: 2000\n\n"
            yield f"data: {json.dumps(build_status_dict())}\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    if ctx.state.is_streaming and not ctx.state.is_paused:
                        yield f"data: {json.dumps(build_status_dict())}\n\n"
                    else:
                        yield ": heartbeat\n\n"
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
