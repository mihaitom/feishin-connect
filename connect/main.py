"""main.py — Feishin Connect: streams Navidrome tracks to Sonos / AirPlay

Startup:
  uv run python main.py
  uvicorn main:app --host 0.0.0.0 --port 9181
"""

import logging
import os
import shutil
import traceback
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import DEFAULT_TOKEN as _DEFAULT_TOKEN
from auth import TOKEN as _CONNECT_TOKEN
from routes.devices import router as devices_router
from routes.lyrics import router as lyrics_router
from routes.pairing import router as pairing_router
from routes.playback import router as playback_router
from routes.proxy import router as proxy_router
from routes.stream import router as stream_router
from state import PORT, ctx, get_local_ip

load_dotenv()


class _ShortNameFilter(logging.Filter):
    """Strip the redundant "connect." prefix from logger names (and rename
    the bare "connect" root logger to "main"), so log lines read e.g.
    "lyrics" / "playback" instead of "connect.lyrics" / "connect.playback" —
    shorter and lines up with the other loggers (delivery, sonos, pyatv, ...).
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name.startswith("connect."):
            record.name = record.name.removeprefix("connect.")
        elif record.name == "connect":
            record.name = "main"
        return True


_LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)-9s %(message)s"
_LOG_DATEFMT = "%H:%M:%S"
logging.basicConfig(level=logging.INFO, format=_LOG_FORMAT, datefmt=_LOG_DATEFMT)
for _handler in logging.root.handlers:
    _handler.addFilter(_ShortNameFilter())
logger = logging.getLogger("connect")

_DEBUG = os.getenv("DEBUG", "").strip().lower() in ("1", "true", "yes", "on")

# Reformat uvicorn's own loggers (startup/error/access) to match the format
# used above, so every log line — ours and uvicorn's — looks the same.
# uvicorn.access logs every incoming request and is only useful for
# DEBUG=true troubleshooting.
UVICORN_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": _LOG_FORMAT, "datefmt": _LOG_DATEFMT},
        "access": {"format": _LOG_FORMAT, "datefmt": _LOG_DATEFMT},
    },
    "filters": {
        "short_name": {"()": _ShortNameFilter},
    },
    "handlers": {
        "default": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "filters": ["short_name"],
            "stream": "ext://sys.stdout",
        },
        "access": {
            "class": "logging.StreamHandler",
            "formatter": "access",
            "filters": ["short_name"],
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {
            "handlers": ["access"],
            "level": "INFO" if _DEBUG else "WARNING",
            "propagate": False,
        },
    },
}

# Verbose playback diagnostics. Set DEBUG=true to surface full protocol/playback
# logs across every renderer at once: AirPlay (pyatv), Sonos (SoCo) and the
# app's own delivery/streamer/playback loggers.
#   connect → also covers children connect.streamer / connect.playback
_DEBUG_LOGGERS = ("connect", "delivery", "sonos", "pyatv", "soco")

# httpx/httpcore log every outgoing request at INFO, which is only useful for
# DEBUG=true troubleshooting — keep them quiet otherwise.
_HTTP_CLIENT_LOGGERS = ("httpx", "httpcore")

if _DEBUG:
    for _name in _DEBUG_LOGGERS:
        logging.getLogger(_name).setLevel(logging.DEBUG)
    for _name in _HTTP_CLIENT_LOGGERS:
        logging.getLogger(_name).setLevel(logging.DEBUG)
else:
    for _name in _HTTP_CLIENT_LOGGERS:
        logging.getLogger(_name).setLevel(logging.WARNING)


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

    if _CONNECT_TOKEN == _DEFAULT_TOKEN:
        logger.warning(
            "⚠️  Using default CONNECT_TOKEN — set a custom value in docker-compose for real security"
        )
    else:
        logger.info("🔒 Token auth enabled (custom CONNECT_TOKEN set)")
    logger.info("⏳ Waiting for Feishin /config (media server credentials)")
    yield


app = FastAPI(title="Feishin Connect", lifespan=lifespan)
_ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
_ALLOWED_ORIGINS: list[str] = (
    [o.strip() for o in _ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
    if _ALLOWED_ORIGINS_ENV
    else ["null"]  # Electron file:// origin appears as "null"
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"http://localhost(:[0-9]+)?",
)

app.include_router(stream_router)
app.include_router(playback_router)
app.include_router(devices_router)
app.include_router(pairing_router)
app.include_router(lyrics_router)
app.include_router(proxy_router)


if __name__ == "__main__":
    try:
        # Pass the app object directly — string-based import ("main:app") breaks
        # in PyInstaller bundles because the module loader works differently.
        uvicorn.run(
            app, host="0.0.0.0", port=PORT, log_config=UVICORN_LOG_CONFIG, reload=False
        )
    except Exception:
        traceback.print_exc()
