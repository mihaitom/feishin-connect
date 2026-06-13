"""routes/playback.py — /play, /play-url, /pause, /resume, /stop"""

import asyncio
import logging
import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import require_token

from state import compute_position, ctx, event_bus, resolve_target, stream_url

logger = logging.getLogger("connect.playback")
router = APIRouter(dependencies=[Depends(require_token)])


async def _apply_position_offset(target, generation: int) -> None:
    """Set `position_offset` for the track that just started playing.

    `compute_position()` returns `wall_elapsed + position_offset`. A device
    that's buffering lags behind the wall clock, so `position_offset` is
    normally negative (e.g. -2s for AirPlay's startup buffer). This is what
    keeps the lyrics view in sync with what's actually audible.

    AirPlay has no position feedback, so it gets a fixed startup-buffering
    estimate (FIXED_OFFSET, a positive "delay" magnitude). Sonos/Chromecast
    expose real device position — poll briefly once to measure the actual
    delay, then keep it constant for the rest of the track (re-buffering
    mid-track is not accounted for).
    """
    st = ctx.state
    deliveries = getattr(target, "deliveries", [target])

    fixed = max((d.FIXED_OFFSET for d in deliveries), default=0.0)
    if fixed:
        st.position_offset = -fixed
        logger.info(f"[lyrics-sync] fixed position_offset={st.position_offset:.2f}s")
        await event_bus.broadcast()
        return

    candidate = next((d for d in deliveries if d.SUPPORTS_POSITION), None)
    if candidate is None:
        return

    deadline = time.time() + 10.0
    while time.time() < deadline:
        await asyncio.sleep(0.5)
        if st.play_generation != generation or not st.is_streaming:
            return
        try:
            device_pos = await candidate.get_position()
        except Exception:
            continue
        if not device_pos:
            continue
        wall_elapsed = time.time() - st.play_start_time
        st.position_offset = device_pos - wall_elapsed
        logger.info(
            f"[lyrics-sync] {candidate.target}: calibrated position_offset="
            f"{st.position_offset:.2f}s (device {device_pos:.2f}s vs. wall {wall_elapsed:.2f}s)"
        )
        await event_bus.broadcast()
        return


def _current_track_play_args() -> tuple[str, str, str | None]:
    """Return (title, artist, album_art_url) for the current track, used when
    restarting the stream (resume/seek) so Now-Playing metadata isn't lost."""
    track = ctx.state.current_track
    if not track:
        return "Connect", "", None
    return track.title, track.artist, ctx.media.get_cover_art_url(track.cover_art_id)


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
        return {
            "error": "Media server not configured — waiting for /config from Feishin"
        }
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
    st.position_offset = 0.0
    st.play_generation += 1
    st.track_ended = False

    if not target:
        logger.info(f"[play] No target — stream available at {url}")
        st.active_delivery = None
        await event_bus.broadcast()
        return {"status": "playing", "stream_url": url}

    st.active_delivery = target
    album_art_url = ctx.media.get_cover_art_url(track.cover_art_id)
    try:
        await target.play(url, track.title, track.artist, album_art_url)
    except Exception as e:
        logger.error(f"[play] Delivery error: {e}", exc_info=True)
        return {"error": str(e)}

    asyncio.create_task(_apply_position_offset(target, st.play_generation))
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
    st.position_offset = 0.0
    st.play_generation += 1
    st.track_ended = False
    st.active_delivery = target

    try:
        await target.play(req.url, req.title)
    except Exception as e:
        logger.error(f"[play-url] Delivery error: {e}", exc_info=True)
        return {"error": str(e)}

    asyncio.create_task(_apply_position_offset(target, st.play_generation))
    await event_bus.broadcast()
    return {"status": "playing", "url": req.url}


@router.post("/pause")
async def pause_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.pause()
    elapsed = compute_position()
    # resume_offset is the raw wall-clock position (without position_offset),
    # so resuming doesn't double-apply the device's startup-buffering delay.
    st.resume_offset = max(0.0, elapsed - st.position_offset)
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
        await st.active_delivery.play(stream_url(), *_current_track_play_args())

    await event_bus.broadcast()
    return {"paused": False}


class SeekRequest(BaseModel):
    position: float


@router.post("/seek")
async def seek_playback(body: SeekRequest):
    st = ctx.state
    position = max(0.0, body.position)
    if st.current_track:
        position = min(position, st.current_track.duration)

    # position is the displayed (offset-adjusted) target; play_start_time
    # tracks the raw wall-clock position, so subtract position_offset back out.
    raw_position = max(0.0, position - st.position_offset)
    st.resume_offset = raw_position
    st.play_start_time = time.time() - raw_position

    if st.is_paused:
        st.paused_elapsed = position
    else:
        st.play_generation += 1
        if st.active_delivery:
            await st.active_delivery.play(stream_url(), *_current_track_play_args())

    logger.info(f"[seek] ⏩ {position:.1f}s")
    await event_bus.broadcast()
    return {"position": position}


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
