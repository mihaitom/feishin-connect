"""main.py — Feishin Connect: streams Navidrome tracks to Sonos / AirPlay

Startup:
  uv run python main.py
  uvicorn main:app --host 0.0.0.0 --port 8765
"""

import logging
import shutil
import traceback
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.devices import router as devices_router
from routes.pairing import router as pairing_router
from routes.playback import router as playback_router
from routes.proxy import router as proxy_router
from routes.stream import router as stream_router
from state import PORT, ctx, get_local_ip

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("connect")


@asynccontextmanager
async def lifespan(_: FastAPI):
    local_ip = get_local_ip()
    logger.info(f"🎵 Stream: http://{local_ip}:{PORT}/stream")
    logger.info(f"🔌 API:    http://{local_ip}:{PORT}/")

    if shutil.which("ffmpeg"):
        logger.info("✅ ffmpeg found")
    else:
        logger.error("❌ ffmpeg NOT FOUND — streaming will fail!")

    if ctx.delivery.deliveries:
        for t in ctx.delivery.list_targets():
            logger.info(f"🔊 Target: {t['type']}:{t['name']}")
    else:
        logger.info("ℹ️  No TARGETS env — controlled via Feishin /play")

    logger.info("⏳ Waiting for Feishin /config (media server credentials)")
    yield


app = FastAPI(title="Feishin Connect", lifespan=lifespan)
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
app.include_router(pairing_router)
app.include_router(proxy_router)


if __name__ == "__main__":
    try:
        # Pass the app object directly — string-based import ("main:app") breaks
        # in PyInstaller bundles because the module loader works differently.
        uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info", reload=False)
    except Exception:
        traceback.print_exc()
