"""routes/pairing.py — AirPlay 2 Pairing-Endpoints"""

import asyncio
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import require_token
from delivery import credentials

logger = logging.getLogger("connect.pairing")
router = APIRouter(prefix="/pair/airplay", dependencies=[Depends(require_token)])

# Active pairing sessions: device_name → pyatv pairing object
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

    # Clean up any previous session for this device
    old = _sessions.pop(req.name, None)
    if old:
        try:
            await old.finish()
        except Exception:
            pass

    logger.info(f"[pairing] Scanning for '{req.name}' to pair...")
    devices = await pyatv.scan(asyncio.get_event_loop(), timeout=10)
    conf = next((d for d in devices if d.name.lower() == req.name.lower()), None)

    if not conf:
        available = [d.name for d in devices]
        return JSONResponse(
            {"error": f"Device '{req.name}' not found. Available: {available}"},
            status_code=404,
        )

    try:
        # AirPlay 2 devices (HomePod, Sonos Era) require Protocol.AirPlay (HAP).
        # Protocol.RAOP returns 470 "Connection Authorization Required" on AirPlay 2.
        pairing = await pyatv.pair(conf, Protocol.AirPlay, asyncio.get_event_loop())
        await pairing.begin()
    except Exception as e:
        logger.error(f"[pairing] Start failed for '{req.name}': {e}")
        try:
            await pairing.close()
        except Exception:
            pass
        return JSONResponse({"error": str(e)}, status_code=500)

    _sessions[req.name] = pairing
    logger.info(
        f"[pairing] Started: '{req.name}' — "
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
            {
                "error": f"No active pairing session for '{req.name}'. Call /start first."
            },
            status_code=400,
        )

    try:
        if req.pin is not None:
            pairing.pin(req.pin)  # synchronous method, no await
        await pairing.finish()
    except Exception as e:
        err_str = str(e)
        _sessions.pop(req.name, None)
        try:
            await pairing.close()
        except Exception:
            pass

        # 470 = Device requires MFi hardware auth (Sonos-proprietary AirPlay 2 implementation)
        if "470" in err_str:
            msg = (
                f"'{req.name}' does not support pyatv pairing (HTTP 470 — MFi authentication "
                f"required). Sonos speakers should be added as 'Sonos' devices, not AirPlay. "
                f"HomePod and Apple TV work here."
            )
        else:
            msg = err_str

        logger.error(f"[pairing] Finish failed for '{req.name}': {msg}")
        return JSONResponse({"error": msg}, status_code=500)

    creds = pairing.service.credentials
    _sessions.pop(req.name, None)
    try:
        await pairing.close()
    except Exception:
        pass

    if not creds:
        return JSONResponse(
            {"error": "Pairing completed but no credentials received."},
            status_code=500,
        )

    credentials.save(req.name, creds)
    logger.info(f"[pairing] ✓ Success: '{req.name}'")
    return {"success": True, "name": req.name}


@router.delete("/{name}")
async def unpair(name: str):
    deleted = credentials.delete(name)
    if not deleted:
        return JSONResponse({"error": f"'{name}' was not paired."}, status_code=404)
    return {"success": True, "name": name}
