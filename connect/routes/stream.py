"""routes/stream.py — GET /stream, GET /status"""

import logging

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

from state import compute_position, ctx
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
    if not ctx.state.current_tracks:
        logger.warning("[stream] No track loaded — send an empty response (204)")
        return StreamingResponse(iter([b""]), media_type="audio/mpeg", status_code=204)

    start_idx = ctx.state.current_track_index
    tracks = ctx.state.current_tracks
    track_urls = [ctx.navidrome.get_stream_url(t.id) for t in tracks[start_idx:]]

    logger.info(
        f"[stream] Client connected — Track {start_idx + 1}/{len(tracks)}, "
        f"{len(track_urls)} URL(s) in queue"
    )
    for i, url in enumerate(track_urls[:3]):
        logger.debug(f"[stream]   [{start_idx + i + 1}] {url[:100]}")

    def on_track_start(relative_idx: int) -> None:
        idx = start_idx + relative_idx
        t = tracks[idx]
        logger.info(f"[stream] ▶ [{idx + 1}/{len(tracks)}] {t.artist} — {t.title} ({t.duration}s)")

    return StreamingResponse(
        stream_tracks(track_urls, on_track_start=on_track_start),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status")
async def status():
    idx, elapsed = compute_position()
    st = ctx.state

    current_track = None
    if st.current_tracks and 0 <= idx < len(st.current_tracks):
        t = st.current_tracks[idx]
        current_track = {
            "artist": t.artist,
            "cover_art_url": ctx.navidrome.get_cover_art_url(t.cover_art_id),
            "duration": t.duration,
            "title": t.title,
        }

    from delivery import DeliveryManager
    if isinstance(st.active_delivery, DeliveryManager):
        active_targets = st.active_delivery.list_targets()
    elif st.active_delivery is not None:
        active_targets = [{
            "name": st.active_delivery.target,
            "type": type(st.active_delivery).__name__.replace("Delivery", "").lower(),
        }]
    else:
        active_targets = []

    return {
        "current_track": current_track,
        "current_track_index": idx,
        "elapsed": elapsed,
        "paused": st.is_paused,
        "radio": st.radio_info,
        "streaming": st.is_streaming,
        "targets": active_targets,
        "total_tracks": len(st.current_tracks),
    }
