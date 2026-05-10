"""routes/pairing.py — AirPlay 2 Pairing-Endpoints"""

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import credentials

logger = logging.getLogger("connect.pairing")
router = APIRouter(prefix="/pair/airplay")

# Laufende Pairing-Sessions: device_name → pyatv Pairing-Objekt
_sessions: dict[str, object] = {}


class StartRequest(BaseModel):
    name: str


class FinishRequest(BaseModel):
    name: str
    pin: int | None = None


@router.get("")
async def list_paired():
    return {"paired": credentials.list_paired()}


@router.post("/start")
async def start_pairing(req: StartRequest):
    import pyatv
    from pyatv.const import Protocol

    # Vorherige Session für dieses Gerät aufräumen
    old = _sessions.pop(req.name, None)
    if old:
        try:
            await old.finish()
        except Exception:
            pass

    logger.info(f"[pairing] Suche '{req.name}' für Pairing...")
    devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
    conf = next((d for d in devices if d.name.lower() == req.name.lower()), None)

    if not conf:
        available = [d.name for d in devices]
        return JSONResponse(
            {"error": f"Gerät '{req.name}' nicht gefunden. Verfügbar: {available}"},
            status_code=404,
        )

    try:
        # AirPlay 2 Geräte (HomePod, Sonos Era) brauchen Protocol.AirPlay (HAP).
        # Protocol.RAOP gibt 470 "Connection Authorization Required" auf AirPlay 2.
        pairing = await pyatv.pair(conf, Protocol.AirPlay, asyncio.get_event_loop())
        await pairing.begin()
    except Exception as e:
        logger.error(f"[pairing] Start fehlgeschlagen für '{req.name}': {e}")
        try:
            await pairing.close()
        except Exception:
            pass
        return JSONResponse({"error": str(e)}, status_code=500)

    _sessions[req.name] = pairing
    logger.info(
        f"[pairing] Gestartet: '{req.name}' — "
        f"device_provides_pin={pairing.device_provides_pin}"
    )
    return {
        "device_provides_pin": pairing.device_provides_pin,
        "name": req.name,
    }


@router.post("/finish")
async def finish_pairing(req: FinishRequest):
    pairing = _sessions.get(req.name)
    if not pairing:
        return JSONResponse(
            {"error": f"Keine aktive Pairing-Session für '{req.name}'. Zuerst /start aufrufen."},
            status_code=400,
        )

    try:
        if req.pin is not None:
            pairing.pin(req.pin)  # synchrone Methode, kein await
        await pairing.finish()
    except Exception as e:
        err_str = str(e)
        _sessions.pop(req.name, None)
        try:
            await pairing.close()
        except Exception:
            pass

        # 470 = Gerät verlangt MFi-Hardware-Auth (Sonos-proprietäre AirPlay 2 Implementierung)
        if "470" in err_str:
            msg = (
                f"'{req.name}' unterstützt kein pyatv-Pairing (HTTP 470 — MFi-Authentifizierung "
                f"erforderlich). Sonos-Lautsprecher sollten als 'Sonos'-Gerät hinzugefügt werden, "
                f"nicht als AirPlay. HomePod und Apple TV funktionieren hier."
            )
        else:
            msg = err_str

        logger.error(f"[pairing] Finish fehlgeschlagen für '{req.name}': {msg}")
        return JSONResponse({"error": msg}, status_code=500)

    creds = pairing.service.credentials
    _sessions.pop(req.name, None)
    try:
        await pairing.close()
    except Exception:
        pass

    if not creds:
        return JSONResponse(
            {"error": "Pairing abgeschlossen, aber keine Credentials erhalten."},
            status_code=500,
        )

    credentials.save(req.name, creds)
    logger.info(f"[pairing] ✓ Erfolgreich: '{req.name}'")
    return {"success": True, "name": req.name}


@router.delete("/{name}")
async def unpair(name: str):
    deleted = credentials.delete(name)
    if not deleted:
        return JSONResponse({"error": f"'{name}' war nicht gepaired."}, status_code=404)
    return {"success": True, "name": name}
