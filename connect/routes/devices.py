"""routes/devices.py — /config, /discover, /volume, /device-volume, /device-stop, /join"""

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from delivery import (
    AirPlayDelivery,
    BaseDelivery,
    DeliveryManager,
    SonosDelivery,
    discover_airplay,
    discover_sonos,
)
from state import ctx, find_sonos, stream_url
from subsonic import SubsonicClient

logger = logging.getLogger("connect.devices")
router = APIRouter()


class ConfigRequest(BaseModel):
    credential: str
    url: str


@router.post("/config")
async def configure(req: ConfigRequest):
    ctx.navidrome = SubsonicClient(req.url, credential=req.credential)
    logger.info(f"[config] Navidrome konfiguriert: {req.url}")
    return {"status": "ok"}


@router.get("/discover")
async def discover():
    logger.info("[discover] Suche Sonos- und AirPlay-Geräte …")
    sonos_res, airplay_res = await asyncio.gather(
        discover_sonos(),
        discover_airplay(),
        return_exceptions=True,
    )

    sonos = sonos_res if isinstance(sonos_res, list) else []
    airplay = airplay_res if isinstance(airplay_res, list) else []

    if isinstance(sonos_res, Exception):
        logger.warning(f"[discover] Sonos Fehler: {sonos_res}")
    if isinstance(airplay_res, Exception):
        logger.warning(f"[discover] AirPlay Fehler: {airplay_res}")

    logger.info(f"[discover] {len(sonos)} Sonos, {len(airplay)} AirPlay gefunden")
    for d in sonos:
        logger.debug(f"[discover]   Sonos: {d['name']} ({d.get('ip', '?')})")
    for d in airplay:
        logger.debug(f"[discover]   AirPlay: {d['name']} ({d.get('address', '?')})")

    return {"airplay": airplay, "sonos": sonos}


class VolumeRequest(BaseModel):
    volume: int


@router.get("/volume")
async def get_volume():
    sonos_targets = find_sonos(ctx.state.active_delivery)
    if not sonos_targets:
        return {"error": "Kein Sonos-Target aktiv"}
    try:
        device = await asyncio.to_thread(sonos_targets[0]._get_device)
        return {"volume": device.volume}
    except Exception as e:
        logger.warning(f"[volume] get Fehler: {e}")
        return {"error": str(e)}


@router.post("/volume")
async def set_volume(req: VolumeRequest):
    volume = max(0, min(100, req.volume))
    sonos_targets = find_sonos(ctx.state.active_delivery)
    if not sonos_targets:
        return {"error": "Kein Sonos-Target aktiv"}

    async def _set(d: SonosDelivery):
        device = await asyncio.to_thread(d._get_device)
        await asyncio.to_thread(setattr, device, "volume", volume)

    await asyncio.gather(*[_set(d) for d in sonos_targets], return_exceptions=True)
    return {"volume": volume}


@router.get("/device-volume")
async def get_device_volume(device_type: str, name: str):
    if device_type != "sonos":
        return {"error": "Lautstärke nur für Sonos verfügbar"}
    try:
        device = await asyncio.to_thread(SonosDelivery(name)._get_device)
        return {"volume": device.volume}
    except Exception as e:
        logger.warning(f"[device-volume] get '{name}': {e}")
        return {"error": str(e)}


@router.post("/device-volume")
async def set_device_volume(device_type: str, name: str, req: VolumeRequest):
    if device_type != "sonos":
        return {"error": "Lautstärke nur für Sonos verfügbar"}
    volume = max(0, min(100, req.volume))
    try:
        device = await asyncio.to_thread(SonosDelivery(name)._get_device)
        await asyncio.to_thread(setattr, device, "volume", volume)
        return {"volume": volume}
    except Exception as e:
        logger.warning(f"[device-volume] set '{name}': {e}")
        return {"error": str(e)}


@router.post("/device-stop")
async def stop_device(device_type: str, name: str):
    """Stop one device while keeping others playing.

    For Sonos coordinators: unjoins remaining followers first so the coordinator's
    stop command doesn't kill the whole group, then restarts the stream on them.
    """
    type_cls = SonosDelivery if device_type == "sonos" else AirPlayDelivery
    active = ctx.state.active_delivery

    remaining: list[BaseDelivery] = []
    if isinstance(active, DeliveryManager):
        remaining = [
            d for d in active.deliveries
            if not (isinstance(d, type_cls) and d.target == name)
        ]
    elif active and not (isinstance(active, type_cls) and active.target == name):
        remaining = [active]

    logger.info(
        f"[device-stop] {device_type}:{name} — verbleibend: "
        f"{[d.target for d in remaining] or 'keins'}"
    )

    need_restart = False
    try:
        if device_type == "sonos":
            import soco as _soco
            all_soco = await asyncio.to_thread(lambda: list(_soco.discover() or []))
            target_dev = next(
                (d for d in all_soco if d.player_name.lower() == name.lower()), None
            )
            if target_dev:
                is_coord = await asyncio.to_thread(lambda: target_dev.is_coordinator)
                logger.debug(f"[device-stop] {name} ist_koordinator={is_coord}")

                if is_coord and remaining:
                    logger.info(f"[device-stop] Entgruppiere {len(remaining)} Follower …")
                    for rem in remaining:
                        if isinstance(rem, SonosDelivery):
                            rem_dev = next(
                                (d for d in all_soco
                                 if d.player_name.lower() == rem.target.lower()),
                                None,
                            )
                            if rem_dev:
                                try:
                                    await asyncio.to_thread(rem_dev.unjoin)
                                    logger.debug(f"[device-stop] {rem.target} entgruppt")
                                except Exception as ex:
                                    logger.warning(f"[device-stop] unjoin {rem.target}: {ex}")
                    await asyncio.sleep(0.3)
                    need_restart = True
                elif not is_coord:
                    await asyncio.to_thread(target_dev.unjoin)
                    await asyncio.sleep(0.1)

                await asyncio.to_thread(target_dev.stop)
                logger.info(f"[device-stop] {name} gestoppt")
            else:
                logger.warning(f"[device-stop] Sonos '{name}' nicht im Netzwerk gefunden")
        else:
            await AirPlayDelivery(name).stop()

    except Exception as e:
        logger.error(f"[device-stop] {name}: {e}", exc_info=True)
        return {"error": str(e)}

    st = ctx.state
    if not remaining:
        st.is_streaming = False
        st.active_delivery = None
    else:
        new_delivery: BaseDelivery | DeliveryManager = (
            remaining[0] if len(remaining) == 1
            else DeliveryManager.from_deliveries(remaining)
        )
        st.active_delivery = new_delivery

        if need_restart and st.is_streaming:
            url = st.radio_info["url"] if st.radio_info else stream_url()
            title = st.radio_info["title"] if st.radio_info else "Connect"
            logger.info(f"[device-stop] Starte Stream neu: {url}")
            try:
                await new_delivery.play(url, title)
            except Exception as e:
                logger.error(f"[device-stop] Restart Fehler: {e}", exc_info=True)

    return {"status": "stopped", "device": name}


class JoinRequest(BaseModel):
    target_name: str
    target_type: str


@router.post("/join")
async def join_stream(req: JoinRequest):
    st = ctx.state
    if not st.is_streaming:
        return {"error": "Kein aktiver Stream"}

    url = stream_url()
    type_cls = SonosDelivery if req.target_type == "sonos" else AirPlayDelivery
    new_d: BaseDelivery = type_cls(req.target_name)

    logger.info(f"[join] {req.target_type}:{req.target_name} → {url}")

    if req.target_type == "sonos":
        existing_sonos = find_sonos(st.active_delivery)
        if existing_sonos:
            try:
                coordinator = await asyncio.to_thread(existing_sonos[0]._get_device)
                joiner = await asyncio.to_thread(new_d._get_device)
                await asyncio.to_thread(joiner.join, coordinator)
                logger.info(f"[join] {req.target_name} tritt Gruppe von {existing_sonos[0].target} bei")
            except Exception as e:
                logger.warning(f"[join] Gruppen-Join fehlgeschlagen ({e}), Fallback auf eigenen Stream")
                await new_d.play(url)
        else:
            await new_d.play(url)
    else:
        await new_d.play(url)

    if isinstance(st.active_delivery, DeliveryManager):
        existing = {d.target for d in st.active_delivery.deliveries}
        if req.target_name not in existing:
            st.active_delivery.deliveries.append(new_d)
    elif st.active_delivery:
        st.active_delivery = DeliveryManager.from_deliveries([st.active_delivery, new_d])
    else:
        st.active_delivery = new_d

    return {"status": "joined", "device": req.target_name}
