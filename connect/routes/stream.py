"""routes/stream.py — GET /stream/{session_id}, GET /status, GET /events"""

import asyncio
import json
import logging
import time

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse

from core.auth import require_token
from core.session import DEFAULT_SESSION_ID, SessionState, build_status_dict, get_session, registry
from core.streamer import stream_tracks
from routes.playback import play_queue_index

logger = logging.getLogger("connect.stream")
router = APIRouter()


async def _fire_track_end(session: SessionState, my_generation: int, wait: float) -> None:
    """Fires track-end signal after waiting for Sonos to finish playback.

    Runs as an independent task (see audio_stream's stream_with_completion())
    so Sonos closing the HTTP connection cannot cancel it (that CancelledError
    would only affect stream_with_completion itself). Module-level (not
    nested in audio_stream) so it's directly testable, same as
    routes/playback.py's _apply_position_offset.

    Auto-advances to the next queue item itself when one's loaded (pushed via
    /queue — see routes/playback.py, now also pushed while casting, not just
    local-owner mirroring) instead of only marking track_ended and waiting
    for the frontend to notice and issue a fresh /play. The whole point of
    casting is that playback keeps going on the physical device independently
    of the browser tab staying active/reachable — a locked phone's browser
    tab can have its JS suspended for as long as the screen stays locked,
    which used to silently stall playback at the end of every track until the
    phone was unlocked again.
    """
    if wait > 0.5:
        logger.info(f"[stream] FFmpeg done early — waiting {wait:.1f}s for playback to finish")
        await asyncio.sleep(wait)
    st = session.state
    if not (
        st.is_streaming and not st.clock.is_paused and st.clock.play_generation == my_generation
    ):
        return

    next_index = st.queue_index + 1
    if st.queue and next_index < len(st.queue):
        result = await play_queue_index(session, next_index, force=False)
        if "error" not in result:
            logger.info(f"[stream] Track finished — auto-advanced to queue index {next_index}")
            return
        logger.warning(f"[stream] Auto-advance to queue index {next_index} failed: {result['error']}")

    logger.info("[stream] Track finished — marking stream complete")
    st.is_streaming = False
    st.track_ended = True
    await session.event_bus.broadcast(build_status_dict(session))


@router.head("/stream")
@router.head("/stream/{session_id}")
async def audio_stream_head(session_id: str = DEFAULT_SESSION_ID):
    """ffmpeg probes the URL with HEAD before streaming — answer without starting ffmpeg."""
    return Response(
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/stream")
@router.get("/stream/{session_id}")
async def audio_stream(session_id: str = DEFAULT_SESSION_ID):
    # Cast devices call this URL back with no way to send custom headers, so
    # the session id lives in the path itself (bare /stream is a compat alias
    # for DEFAULT_SESSION_ID — same reasoning as why this route has never had
    # token auth: the device dialing back in can't send one either).
    session = await registry.get_or_create(session_id)

    if not session.state.current_track:
        logger.warning("[stream] No track loaded — returning 204")
        return StreamingResponse(iter([b""]), media_type="audio/mpeg", status_code=204)

    track = session.state.current_track
    track_url = session.media.get_stream_url(track.id)

    # Captured now (for this connection's -ss), but *not* cleared yet — see
    # stream_with_completion(), which only clears it once this connection has
    # actually started producing audio. A device can open (and abandon) a
    # connection to /stream before ever reading data — most commonly the very
    # first connection of a session, while e.g. a Sonos coordinator is still
    # settling — and clearing eagerly here would let that abandoned attempt
    # silently discard the seek offset before the real connection arrives,
    # making the device audibly restart from 0:00 while our own state (and
    # thus the displayed position) still reports the correct position.
    offset = session.state.clock.resume_offset

    logger.info(
        f"[stream] Client connected — {track.artist} — {track.title}"
        + (f" (seek {offset:.1f}s)" if offset > 0.5 else "")
    )

    def on_track_start(_: int) -> None:
        gain = session.state.current_track_gain
        gain_str = f", gain={gain:.2f}" if gain != 1.0 else ""
        logger.info(
            f"[stream] ▶ {track.artist} — {track.title} ({track.duration}s{gain_str})"
        )

    async def stream_with_completion():
        my_generation = session.state.clock.play_generation
        offset_consumed = False
        try:
            async for chunk in stream_tracks(
                [track_url],
                on_track_start=on_track_start,
                start_offset=offset,
                gain=session.state.current_track_gain,
            ):
                if not offset_consumed:
                    offset_consumed = True
                    # Only clear resume_offset once THIS connection has
                    # actually started producing audio — and only if no newer
                    # /play, /seek or /resume has since set a different one.
                    if session.state.clock.play_generation == my_generation:
                        session.state.clock.resume_offset = 0.0
                yield chunk
        except asyncio.CancelledError:
            raise  # client disconnected mid-stream — not a natural end

        # FFmpeg may stream faster than real-time because Sonos buffers aggressively.
        # Schedule completion in an independent task so Sonos closing the connection
        # after receiving all data doesn't cancel the track-end signal.
        st = session.state
        if (
            st.is_streaming
            and not st.clock.is_paused
            and st.clock.play_generation == my_generation
        ):
            wait = 0.0
            if st.current_track and st.clock.play_start_time:
                wait = max(
                    0.0,
                    (st.clock.play_start_time + st.current_track.duration)
                    - time.time(),
                )
            asyncio.create_task(_fire_track_end(session, my_generation, wait))

    return StreamingResponse(
        stream_with_completion(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/status", dependencies=[Depends(require_token)])
async def status(session: SessionState = Depends(get_session)):
    return build_status_dict(session)


@router.get("/events", dependencies=[Depends(require_token)])
async def status_events(session: SessionState = Depends(get_session)):
    queue = session.event_bus.subscribe()

    async def generator():
        try:
            yield "retry: 2000\n\n"
            yield f"data: {json.dumps(build_status_dict(session))}\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    session.touch()
                    if session.state.is_streaming and not session.state.clock.is_paused:
                        yield f"data: {json.dumps(build_status_dict(session))}\n\n"
                    else:
                        yield ": heartbeat\n\n"
        finally:
            session.event_bus.unsubscribe(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
