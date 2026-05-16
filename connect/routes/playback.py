"""routes/playback.py — /play, /play-url, /pause, /resume, /stop"""

import logging
import time

from fastapi import APIRouter
from pydantic import BaseModel

from state import compute_position, ctx, event_bus, resolve_target, stream_url

logger = logging.getLogger("connect.playback")
router = APIRouter()


class PlayRequest(BaseModel):
    track_ids: list[str]
    targets: list[dict] | None = None
    target_name: str | None = None
    target_type: str | None = None


@router.post("/play")
async def play_tracks(req: PlayRequest):
    if not ctx.media.base_url:
        logger.warning(
            "[play] Rejected: media server not configured (waiting for /config)"
        )
        return {"error": "Media server not configured — waiting for /config from Feishin"}
    if not req.track_ids:
        return {"error": "No track ID provided"}

    track_id = req.track_ids[0]
    try:
        track = ctx.media.get_track(track_id)
    except Exception as e:
        logger.warning(f"[play] Track {track_id} not found: {e}")
        return {"error": f"Track not found: {e}"}

    target = resolve_target(req.targets, req.target_name, req.target_type)
    url = stream_url()
    logger.info(
        f"[play] {track.artist} — {track.title} ({track.duration}s) → target={target}"
    )

    st = ctx.state
    st.current_track = track
    st.is_streaming = True
    st.is_paused = False
    st.radio_info = None
    st.play_start_time = time.time()
    st.paused_elapsed = 0.0
    st.resume_offset = 0.0
    st.play_generation += 1
    st.track_ended = False

    if not target:
        logger.info(f"[play] No target — stream available at {url}")
        st.active_delivery = None
        await event_bus.broadcast()
        return {"status": "playing", "stream_url": url}

    st.active_delivery = target
    try:
        await target.play(url)
    except Exception as e:
        logger.error(f"[play] Delivery error: {e}", exc_info=True)
        return {"error": str(e)}

    await event_bus.broadcast()
    return {"status": "playing", "stream_url": url}


class PlayUrlRequest(BaseModel):
    url: str
    title: str = "Radio"
    targets: list[dict] | None = None
    target_name: str | None = None
    target_type: str | None = None


@router.post("/play-url")
async def play_url(req: PlayUrlRequest):
    target = resolve_target(req.targets, req.target_name, req.target_type)
    if not target:
        return {"error": "No target configured"}

    logger.info(f"[play-url] '{req.title}' → {req.url[:80]}, target={target}")

    st = ctx.state
    st.current_track = None
    st.is_streaming = True
    st.is_paused = False
    st.radio_info = {"title": req.title, "url": req.url}
    st.play_start_time = time.time()
    st.paused_elapsed = 0.0
    st.resume_offset = 0.0
    st.play_generation += 1
    st.track_ended = False
    st.active_delivery = target

    try:
        await target.play(req.url, req.title)
    except Exception as e:
        logger.error(f"[play-url] Delivery error: {e}", exc_info=True)
        return {"error": str(e)}

    await event_bus.broadcast()
    return {"status": "playing", "url": req.url}


@router.post("/pause")
async def pause_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.pause()
    elapsed = compute_position()
    st.resume_offset = elapsed
    st.paused_elapsed = elapsed
    st.is_paused = True
    logger.info(f"[pause] ⏸ {elapsed:.1f}s into track")
    await event_bus.broadcast()
    return {"paused": True}


@router.post("/resume")
async def resume_playback():
    st = ctx.state
    # Recalibrate so compute_position() immediately returns resume_offset
    st.play_start_time = time.time() - st.resume_offset
    st.paused_elapsed = 0.0
    st.is_paused = False
    st.play_generation += 1

    logger.info(f"[resume] ▶ Seeking to {st.resume_offset:.1f}s")

    if st.active_delivery:
        # Force a fresh /stream connection so FFmpeg applies the seek offset
        await st.active_delivery.play(stream_url())

    await event_bus.broadcast()
    return {"paused": False}


@router.post("/stop")
async def stop_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.stop()
    st.is_streaming = False
    st.is_paused = False
    st.track_ended = False
    st.current_track = None
    st.radio_info = None
    st.active_delivery = None
    logger.info("[stop] ⏹ Playback stopped")
    await event_bus.broadcast()
    return {"status": "stopped"}
