"""main.py — Feishin Connect: streams Navidrome tracks to Sonos / AirPlay

Startup:
  uv run python main.py
  uvicorn main:app --host 0.0.0.0 --port 8765
"""

import logging
import shutil
import traceback

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from state import PORT, ctx, get_local_ip
from routes.devices import router as devices_router
from routes.playback import router as playback_router
from routes.stream import router as stream_router

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("connect")

app = FastAPI(title="Feishin Connect")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=["*"],
)

app.include_router(stream_router)
app.include_router(playback_router)
app.include_router(devices_router)


@app.on_event("startup")
async def startup():
    local_ip = get_local_ip()
    logger.info(f"🎵 Stream: http://{local_ip}:{PORT}/stream")
    logger.info(f"🔌 API:    http://{local_ip}:{PORT}/")

    if shutil.which("ffmpeg"):
        logger.info("✅ ffmpeg gefunden")
    else:
        logger.error("❌ ffmpeg NICHT GEFUNDEN — Streaming wird fehlschlagen!")

    if ctx.delivery.deliveries:
        for t in ctx.delivery.list_targets():
            logger.info(f"🔊 Target: {t['type']}:{t['name']}")
    else:
        logger.info("ℹ️  Keine TARGETS env — Steuerung über Feishin /play")

    logger.info("⏳ Warte auf Feishin /config (Navidrome-Zugangsdaten)")


if __name__ == "__main__":
    try:
        uvicorn.run("main:app", host="0.0.0.0", port=PORT, log_level="info", reload=False)
    except Exception:
        traceback.print_exc()
