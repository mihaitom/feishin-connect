"""routes/playback.py — /play, /play-url, /next, /previous, /pause, /resume, /stop"""

import logging
import time

from fastapi import APIRouter
from pydantic import BaseModel

from state import compute_position, ctx, resolve_target, stream_url
from subsonic import Track

logger = logging.getLogger("connect.playback")
router = APIRouter()


class PlayRequest(BaseModel):
    track_ids: list[str]
    targets: list[dict] | None = None
    target_name: str | None = None
    target_type: str | None = None


@router.post("/play")
async def play_tracks(req: PlayRequest):
    if not ctx.navidrome.base_url:
        logger.warning("[play] Abgelehnt: Navidrome nicht konfiguriert (warte auf /config)")
        return {"error": "Navidrome nicht konfiguriert — warte auf /config von Feishin"}
    if not req.track_ids:
        return {"error": "Keine Track-IDs angegeben"}

    tracks: list[Track] = []
    for track_id in req.track_ids:
        try:
            data = ctx.navidrome._get("getSong.view", id=track_id)
            song = data.get("song", {})
            tracks.append(Track(
                id=song["id"],
                title=song.get("title", "Unknown"),
                artist=song.get("artist", "Unknown"),
                duration=song.get("duration", 0),
                cover_art_id=song.get("coverArt", ""),
            ))
        except Exception as e:
            logger.warning(f"[play] Track {track_id} nicht gefunden: {e}")

    if not tracks:
        return {"error": "Keine Tracks gefunden"}

    target = resolve_target(req.targets, req.target_name, req.target_type)
    url = stream_url()
    logger.info(f"[play] {len(tracks)} Tracks → target={target}, stream={url}")
    for t in tracks[:5]:
        logger.info(f"[play]   • {t.artist} — {t.title} ({t.duration}s)")
    if len(tracks) > 5:
        logger.info(f"[play]   … und {len(tracks) - 5} weitere")

    st = ctx.state
    st.current_tracks = tracks
    st.is_streaming = True
    st.is_paused = False
    st.current_track_index = 0
    st.radio_info = None
    st.play_start_time = time.time()
    st.play_start_index = 0
    st.paused_elapsed = 0.0

    if not target:
        logger.info(f"[play] Kein Target — Stream nur unter {url} verfügbar")
        st.active_delivery = None
        return {"status": "playing", "stream_url": url, "tracks": len(tracks)}

    st.active_delivery = target
    try:
        await target.play(url)
    except Exception as e:
        logger.error(f"[play] Delivery Fehler: {e}", exc_info=True)
        return {"error": str(e)}

    return {"status": "playing", "stream_url": url, "tracks": len(tracks)}


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
        return {"error": "Kein Target konfiguriert"}

    logger.info(f"[play-url] '{req.title}' → {req.url[:80]}, target={target}")

    st = ctx.state
    st.current_tracks = []
    st.current_track_index = 0
    st.is_streaming = True
    st.is_paused = False
    st.radio_info = {"title": req.title, "url": req.url}
    st.active_delivery = target

    try:
        await target.play(req.url, req.title)
    except Exception as e:
        logger.error(f"[play-url] Delivery Fehler: {e}", exc_info=True)
        return {"error": str(e)}

    return {"status": "playing", "url": req.url}


@router.post("/next")
async def next_track():
    st = ctx.state
    # Use compute_position() so we skip from the actual playing track, not the
    # last manually-set index (which lags behind when tracks advance naturally).
    current_idx, _ = compute_position()

    if current_idx >= len(st.current_tracks) - 1:
        return {"error": "Bereits letzter Track"}

    new_idx = current_idx + 1
    st.current_track_index = new_idx
    st.play_start_index = new_idx
    st.play_start_time = time.time()
    st.paused_elapsed = 0.0
    st.is_paused = False

    logger.info(f"[next] {current_idx} → {new_idx} / {len(st.current_tracks)}")
    if st.active_delivery:
        await st.active_delivery.play(stream_url())

    return {"current_track_index": new_idx}


@router.post("/previous")
async def previous_track():
    st = ctx.state
    current_idx, _ = compute_position()

    if current_idx <= 0:
        return {"error": "Bereits erster Track"}

    new_idx = current_idx - 1
    st.current_track_index = new_idx
    st.play_start_index = new_idx
    st.play_start_time = time.time()
    st.paused_elapsed = 0.0
    st.is_paused = False

    logger.info(f"[previous] {current_idx} → {new_idx} / {len(st.current_tracks)}")
    if st.active_delivery:
        await st.active_delivery.play(stream_url())

    return {"current_track_index": new_idx}


@router.post("/pause")
async def pause_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.pause()
    st.paused_elapsed = time.time() - st.play_start_time
    st.is_paused = True
    logger.info("[pause] ⏸ Wiedergabe pausiert")
    return {"paused": True}


@router.post("/resume")
async def resume_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.resume()
    # Shift play_start_time forward so elapsed stays correct after the pause gap
    st.play_start_time = time.time() - st.paused_elapsed
    st.is_paused = False
    logger.info("[resume] ▶ Wiedergabe fortgesetzt")
    return {"paused": False}


@router.post("/stop")
async def stop_playback():
    st = ctx.state
    if st.active_delivery:
        await st.active_delivery.stop()
    st.is_streaming = False
    st.is_paused = False
    st.current_tracks = []
    st.current_track_index = 0
    st.radio_info = None
    st.active_delivery = None
    logger.info("[stop] ⏹ Wiedergabe gestoppt")
    return {"status": "stopped"}
