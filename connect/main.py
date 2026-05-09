"""
main.py — Feishin Connect: streams Navidrome tracks to Sonos / AirPlay

Credentials are pushed by Feishin via POST /config on startup.
No env vars needed for Navidrome — only TARGETS and PORT are read from .env.

Start:
  python main.py
  # oder:
  uvicorn main:app --host 0.0.0.0 --port 8765
"""

import asyncio
import logging
import os
import socket
import time
import traceback

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from delivery import AirPlayDelivery, BaseDelivery, DeliveryManager, SonosDelivery, discover_airplay, discover_sonos
from streamer import stream_tracks
from subsonic import SubsonicClient, Track

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("connect")


# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────

TARGETS = os.getenv("TARGETS", "")
PORT    = int(os.getenv("PORT", "8765"))


# ──────────────────────────────────────────────
# State
# ──────────────────────────────────────────────

class AppState:
    def __init__(self):
        self.current_tracks: list[Track] = []
        self.is_streaming: bool = False
        self.is_paused: bool = False
        self.current_track_index: int = 0
        self.radio_info: dict | None = None
        self.active_delivery: BaseDelivery | DeliveryManager | None = None
        # Wall-clock progress tracking (not affected by FFmpeg buffering)
        self.play_start_time: float = 0.0    # wall time when current session started
        self.play_start_index: int = 0       # track index at play_start_time
        self.paused_elapsed: float = 0.0     # seconds into session when paused


state = AppState()
navidrome = SubsonicClient("")   # configured at runtime via POST /config
delivery = DeliveryManager(TARGETS)


def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()


# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────

app = FastAPI(title="Feishin Connect")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=["*"],
)


@app.on_event("startup")
async def startup():
    local_ip = get_local_ip()
    logger.info(f"🎵 Stream:  http://{local_ip}:{PORT}/stream")
    logger.info("⏳ Warte auf Feishin /config für Navidrome-Zugangsdaten")

    if delivery.deliveries:
        for t in delivery.list_targets():
            logger.info(f"🔊 Target:  {t['type']}:{t['name']}")
    else:
        logger.info("ℹ️  Keine TARGETS — Steuerung ausschließlich über Feishin /play")


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/stream")
async def audio_stream():
    """Kontinuierlicher MP3-Stream — startet ab current_track_index."""
    if not state.current_tracks:
        return StreamingResponse(iter([b""]), media_type="audio/mpeg", status_code=204)

    start_idx = state.current_track_index
    track_urls = [navidrome.get_stream_url(t.id) for t in state.current_tracks[start_idx:]]

    def on_track_start(relative_idx: int) -> None:
        # Only log here — wall-clock tracking in AppState handles position/index
        idx = start_idx + relative_idx
        t = state.current_tracks[idx]
        logger.info(f"▶ [{idx + 1}/{len(state.current_tracks)}] {t.artist} — {t.title}")

    return StreamingResponse(
        stream_tracks(track_urls, on_track_start=on_track_start),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _compute_position() -> tuple[int, float]:
    """Compute current track index and elapsed seconds from wall-clock time.

    Using cumulative track durations avoids the FFmpeg-buffering distortion that
    occurs when on_track_start fires early while the previous track is still buffered.
    """
    if not state.current_tracks or not state.play_start_time:
        return state.current_track_index, 0.0

    if state.is_paused:
        elapsed_total = state.paused_elapsed
    else:
        elapsed_total = time.time() - state.play_start_time

    cum = 0.0
    tracks_from_start = state.current_tracks[state.play_start_index:]
    for i, t in enumerate(tracks_from_start):
        if elapsed_total < cum + t.duration:
            return state.play_start_index + i, elapsed_total - cum
        cum += t.duration

    last = len(state.current_tracks) - 1
    return last, float(state.current_tracks[last].duration)


@app.get("/status")
async def status():
    idx, elapsed = _compute_position()

    current_track = None
    if state.current_tracks and 0 <= idx < len(state.current_tracks):
        t = state.current_tracks[idx]
        current_track = {
            "artist": t.artist,
            "cover_art_url": navidrome.get_cover_art_url(t.cover_art_id),
            "duration": t.duration,
            "title": t.title,
        }

    if isinstance(state.active_delivery, DeliveryManager):
        active_targets = state.active_delivery.list_targets()
    elif state.active_delivery is not None:
        active_targets = [{
            "name": state.active_delivery.target,
            "type": type(state.active_delivery).__name__.replace("Delivery", "").lower(),
        }]
    else:
        active_targets = []

    return {
        "current_track": current_track,
        "current_track_index": idx,
        "elapsed": elapsed,
        "paused": state.is_paused,
        "radio": state.radio_info,
        "streaming": state.is_streaming,
        "targets": active_targets,
        "total_tracks": len(state.current_tracks),
    }


def _resolve_target(
    targets: list[dict] | None = None,
    target_name: str | None = None,
    target_type: str | None = None,
) -> BaseDelivery | DeliveryManager | None:
    """Resolve one or more targets from a request into a single delivery object."""
    if targets:
        deliveries: list[BaseDelivery] = []
        for t in targets:
            if t.get("type") == "sonos":
                deliveries.append(SonosDelivery(t["name"]))
            else:
                deliveries.append(AirPlayDelivery(t["name"]))
        return DeliveryManager.from_deliveries(deliveries)
    if target_type and target_name:
        return SonosDelivery(target_name) if target_type == "sonos" else AirPlayDelivery(target_name)
    if delivery.deliveries:
        return delivery
    return None


class PlayRequest(BaseModel):
    track_ids: list[str]
    targets: list[dict] | None = None   # [{"name": ..., "type": ...}] for multiroom
    target_name: str | None = None      # single-target backward compat
    target_type: str | None = None


@app.post("/play")
async def play_tracks(req: PlayRequest):
    """Feishin schickt die aktuelle Queue als Track-IDs."""
    if not navidrome.base_url:
        return {"error": "Navidrome nicht konfiguriert — warte auf /config von Feishin"}
    if not req.track_ids:
        return {"error": "Keine Track-IDs angegeben"}

    tracks = []
    for track_id in req.track_ids:
        try:
            data = navidrome._get("getSong.view", id=track_id)
            song = data.get("song", {})
            tracks.append(Track(
                id=song["id"],
                title=song.get("title", "Unknown"),
                artist=song.get("artist", "Unknown"),
                duration=song.get("duration", 0),
                cover_art_id=song.get("coverArt", ""),
            ))
        except Exception as e:
            logger.warning(f"Track {track_id} nicht gefunden: {e}")

    if not tracks:
        return {"error": "Keine Tracks gefunden"}

    logger.info(f"Play Request: {len(tracks)} Tracks")
    for t in tracks:
        logger.info(f"  • {t.artist} — {t.title}")

    state.current_tracks = tracks
    state.is_streaming = True
    state.is_paused = False
    state.current_track_index = 0
    state.radio_info = None
    state.play_start_time = time.time()
    state.play_start_index = 0
    state.paused_elapsed = 0.0

    stream_url = f"http://{get_local_ip()}:{PORT}/stream"
    target = _resolve_target(req.targets, req.target_name, req.target_type)

    if not target:
        logger.info(f"Kein Target — Stream verfügbar unter: {stream_url}")
        state.active_delivery = None
        return {"status": "playing", "stream_url": stream_url, "tracks": len(tracks)}

    state.active_delivery = target
    await target.play(stream_url)
    return {"status": "playing", "stream_url": stream_url, "tracks": len(tracks)}


@app.post("/next")
async def next_track():
    if state.current_track_index >= len(state.current_tracks) - 1:
        return {"error": "Bereits letzter Track"}
    state.current_track_index += 1
    state.play_start_index = state.current_track_index
    state.play_start_time = time.time()
    state.paused_elapsed = 0.0
    state.is_paused = False
    if state.active_delivery:
        await state.active_delivery.play(f"http://{get_local_ip()}:{PORT}/stream")
    return {"current_track_index": state.current_track_index}


@app.post("/previous")
async def previous_track():
    if state.current_track_index <= 0:
        return {"error": "Bereits erster Track"}
    state.current_track_index -= 1
    state.play_start_index = state.current_track_index
    state.play_start_time = time.time()
    state.paused_elapsed = 0.0
    state.is_paused = False
    if state.active_delivery:
        await state.active_delivery.play(f"http://{get_local_ip()}:{PORT}/stream")
    return {"current_track_index": state.current_track_index}


@app.post("/pause")
async def pause_playback_endpoint():
    if state.active_delivery:
        await state.active_delivery.pause()
    state.paused_elapsed = time.time() - state.play_start_time
    state.is_paused = True
    return {"paused": True}


@app.post("/resume")
async def resume_playback_endpoint():
    if state.active_delivery:
        await state.active_delivery.resume()
    # Shift play_start_time forward so elapsed computation stays accurate after the pause
    state.play_start_time = time.time() - state.paused_elapsed
    state.is_paused = False
    return {"paused": False}


@app.post("/stop")
async def stop_playback():
    if state.active_delivery:
        await state.active_delivery.stop()
    state.is_streaming = False
    state.is_paused = False
    state.current_tracks = []
    state.current_track_index = 0
    state.radio_info = None
    state.active_delivery = None
    return {"status": "stopped"}


class PlayUrlRequest(BaseModel):
    url: str
    title: str = "Radio"
    targets: list[dict] | None = None   # multiroom
    target_name: str | None = None
    target_type: str | None = None


@app.post("/play-url")
async def play_url(req: PlayUrlRequest):
    """Spielt eine direkte Stream-URL (z.B. Radiostream) auf einem Gerät ab."""
    target = _resolve_target(req.targets, req.target_name, req.target_type)
    if not target:
        return {"error": "Kein Target konfiguriert"}

    state.current_tracks = []
    state.current_track_index = 0
    state.is_streaming = True
    state.is_paused = False
    state.radio_info = {"title": req.title, "url": req.url}
    state.active_delivery = target

    await target.play(req.url, req.title)
    return {"status": "playing", "url": req.url}


def _find_sonos(active: BaseDelivery | DeliveryManager | None) -> list[SonosDelivery]:
    """Find all Sonos deliveries in the active target, then fall back to configured targets."""
    if isinstance(active, SonosDelivery):
        return [active]
    if isinstance(active, DeliveryManager):
        found = [d for d in active.deliveries if isinstance(d, SonosDelivery)]
        if found:
            return found
    return [d for d in delivery.deliveries if isinstance(d, SonosDelivery)]


class VolumeRequest(BaseModel):
    volume: int  # 0-100


@app.get("/volume")
async def get_volume():
    sonos_targets = _find_sonos(state.active_delivery)
    if not sonos_targets:
        return {"error": "Kein Sonos-Target konfiguriert"}
    try:
        device = await asyncio.to_thread(sonos_targets[0]._get_device)
        return {"volume": device.volume}
    except Exception as e:
        return {"error": str(e)}


@app.post("/volume")
async def set_volume(req: VolumeRequest):
    volume = max(0, min(100, req.volume))
    sonos_targets = _find_sonos(state.active_delivery)
    if not sonos_targets:
        return {"error": "Kein Sonos-Target konfiguriert"}

    async def _set(d: SonosDelivery):
        device = await asyncio.to_thread(d._get_device)
        await asyncio.to_thread(setattr, device, "volume", volume)

    await asyncio.gather(*[_set(d) for d in sonos_targets], return_exceptions=True)
    return {"volume": volume}


@app.get("/device-volume")
async def get_device_volume(device_type: str, name: str):
    if device_type != "sonos":
        return {"error": "Lautstärke nur für Sonos verfügbar"}
    try:
        device = await asyncio.to_thread(SonosDelivery(name)._get_device)
        return {"volume": device.volume}
    except Exception as e:
        return {"error": str(e)}


@app.post("/device-volume")
async def set_device_volume(device_type: str, name: str, req: VolumeRequest):
    if device_type != "sonos":
        return {"error": "Lautstärke nur für Sonos verfügbar"}
    volume = max(0, min(100, req.volume))
    try:
        device = await asyncio.to_thread(SonosDelivery(name)._get_device)
        await asyncio.to_thread(setattr, device, "volume", volume)
        return {"volume": volume}
    except Exception as e:
        return {"error": str(e)}


@app.post("/device-stop")
async def stop_device(device_type: str, name: str):
    """Stop a single device while keeping others playing."""
    type_cls = SonosDelivery if device_type == "sonos" else AirPlayDelivery

    try:
        if device_type == "sonos":
            import soco as _soco
            devices = await asyncio.to_thread(lambda: list(_soco.discover() or []))
            target = next((d for d in devices if d.player_name.lower() == name.lower()), None)
            if target:
                is_coord = await asyncio.to_thread(lambda: target.is_coordinator)
                if is_coord:
                    await asyncio.to_thread(target.stop)
                else:
                    # Follower: unjoin from group (this stops playback on it)
                    await asyncio.to_thread(target.unjoin)
                logger.info(f"[Sonos:{name}] gestoppt")
        else:
            await AirPlayDelivery(name).stop()
    except Exception as e:
        logger.error(f"device-stop {name}: {e}")
        return {"error": str(e)}

    if isinstance(state.active_delivery, DeliveryManager):
        state.active_delivery.deliveries = [
            x for x in state.active_delivery.deliveries
            if not (isinstance(x, type_cls) and x.target == name)
        ]
        if not state.active_delivery.deliveries:
            state.is_streaming = False
            state.active_delivery = None
    elif isinstance(state.active_delivery, type_cls) and state.active_delivery.target == name:
        state.is_streaming = False
        state.active_delivery = None

    return {"status": "stopped", "device": name}


class JoinRequest(BaseModel):
    target_name: str
    target_type: str  # "sonos" | "airplay"


@app.post("/join")
async def join_stream(req: JoinRequest):
    """Add a device to the running stream without restarting.

    For Sonos: joins the existing Sonos group for instant sync.
    For AirPlay: starts an independent stream from the current position.
    """
    if not state.is_streaming:
        return {"error": "Kein aktiver Stream"}

    stream_url = f"http://{get_local_ip()}:{PORT}/stream"
    type_cls = SonosDelivery if req.target_type == "sonos" else AirPlayDelivery
    new_d: BaseDelivery = type_cls(req.target_name)

    if req.target_type == "sonos":
        existing_sonos = _find_sonos(state.active_delivery)
        if existing_sonos:
            try:
                coordinator = await asyncio.to_thread(existing_sonos[0]._get_device)
                joiner = await asyncio.to_thread(new_d._get_device)
                await asyncio.to_thread(joiner.join, coordinator)
                logger.info(f"[Sonos] {req.target_name} joined group of {existing_sonos[0].target}")
            except Exception as e:
                logger.warning(f"[Sonos] group join failed ({e}), falling back to independent stream")
                await new_d.play(stream_url)
        else:
            await new_d.play(stream_url)
    else:
        await new_d.play(stream_url)

    # Register in active delivery (avoid duplicates)
    if isinstance(state.active_delivery, DeliveryManager):
        existing = {d.target for d in state.active_delivery.deliveries}
        if req.target_name not in existing:
            state.active_delivery.deliveries.append(new_d)
    elif state.active_delivery:
        state.active_delivery = DeliveryManager.from_deliveries([state.active_delivery, new_d])
    else:
        state.active_delivery = new_d

    return {"status": "joined", "device": req.target_name}


class ConfigRequest(BaseModel):
    credential: str
    url: str


@app.post("/config")
async def configure(req: ConfigRequest):
    """Feishin sends the current server URL + credential on mount."""
    global navidrome
    navidrome = SubsonicClient(req.url, credential=req.credential)
    logger.info(f"🔧 Config updated: {req.url}")
    return {"status": "ok"}


@app.get("/discover")
async def discover():
    sonos, airplay = await asyncio.gather(
        discover_sonos(),
        discover_airplay(),
        return_exceptions=True,
    )
    return {
        "airplay": airplay if isinstance(airplay, list) else {"error": str(airplay)},
        "sonos": sonos if isinstance(sonos, list) else {"error": str(sonos)},
    }


# ──────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    try:
        uvicorn.run("main:app", host="0.0.0.0", port=PORT, log_level="info", reload=False)
    except Exception:
        traceback.print_exc()
