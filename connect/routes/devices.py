"""routes/devices.py — /config, /discover, /volume, /device-volume, /device-stop, /join"""

import asyncio
import logging
import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_token
from core.claims import claims
from core.session import (
    SessionState,
    build_status_dict,
    check_claims,
    displace_target,
    get_session,
    registry,
    track_label,
)
from core.state import ctx, find_sonos, stream_url

from delivery import (
    AirPlayDelivery,
    BaseDelivery,
    ChromecastDelivery,
    DeliveryManager,
    DlnaDelivery,
    SonosDelivery,
    discover_airplay,
    discover_chromecast,
    discover_dlna,
    discover_sonos,
)
from media import JellyfinClient, SubsonicClient

logger = logging.getLogger("connect.devices")
router = APIRouter(dependencies=[Depends(require_token)])


class ConfigRequest(BaseModel):
    credential: str
    url: str
    # "subsonic" (covers Navidrome) or "jellyfin". Defaults to subsonic for
    # backwards compatibility with older Feishin builds that don't send a type.
    server_type: str = "subsonic"
    # Jellyfin requires the user GUID for item lookups; ignored for Subsonic.
    user_id: str = ""
    # Shown to other sessions as "in use by {username}" for claimed devices.
    username: str = ""


@router.post("/config")
async def configure(req: ConfigRequest, session: SessionState = Depends(get_session)):
    internal_url = os.getenv("SERVER_INTERNAL_URL") or os.getenv(
        "NAVIDROME_INTERNAL_URL", ""
    )
    server_type = req.server_type.lower()
    session.display_name = req.username or session.session_id

    if server_type == "jellyfin":
        session.media = JellyfinClient(
            req.url,
            token=req.credential,
            user_id=req.user_id,
            internal_url=internal_url,
        )
        logger.info(
            f"[config] Jellyfin configured: {req.url} "
            f"(internal: {internal_url or 'same'}, user_id: {req.user_id or 'missing'})"
        )
    else:
        session.media = SubsonicClient(
            req.url, credential=req.credential, internal_url=internal_url
        )
        logger.info(
            f"[config] Subsonic configured: {req.url} (internal: {internal_url or 'same'})"
        )
    return {"status": "ok"}


@router.get("/health")
async def health(session: SessionState = Depends(get_session)):
    import shutil

    return {
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "navidrome_configured": bool(session.media.base_url),
    }


async def discover_all() -> dict:
    """Scan for Sonos, AirPlay, Chromecast and DLNA devices and update the
    cache. Global, not session-scoped — the set of devices on the network is
    the same regardless of who's asking (see core/state.py's Context)."""
    cached = ctx.discovered
    logger.info("[discover] Scanning for Sonos, AirPlay, Chromecast and DLNA devices …")
    sonos_res, airplay_res, chromecast_res, dlna_res = await asyncio.gather(
        discover_sonos(),
        discover_airplay(),
        discover_chromecast(),
        discover_dlna(),
        return_exceptions=True,
    )
    sonos = sonos_res if isinstance(sonos_res, list) else cached["sonos"]
    airplay = airplay_res if isinstance(airplay_res, list) else cached["airplay"]
    chromecast = (
        chromecast_res if isinstance(chromecast_res, list) else cached["chromecast"]
    )
    dlna = dlna_res if isinstance(dlna_res, list) else cached["dlna"]
    if isinstance(sonos_res, Exception):
        logger.warning(f"[discover] Sonos error: {sonos_res}")
    if isinstance(airplay_res, Exception):
        logger.warning(f"[discover] AirPlay error: {airplay_res}")
    if isinstance(chromecast_res, Exception):
        logger.warning(f"[discover] Chromecast error: {chromecast_res}")
    if isinstance(dlna_res, Exception):
        logger.warning(f"[discover] DLNA error: {dlna_res}")
    logger.info(
        f"[discover] {len(sonos)} Sonos, {len(airplay)} AirPlay, "
        f"{len(chromecast)} Chromecast, {len(dlna)} DLNA found"
    )
    ctx.discovered = {
        "airplay": airplay,
        "chromecast": chromecast,
        "dlna": dlna,
        "sonos": sonos,
    }
    return ctx.discovered


def _annotate_claims(discovered: dict) -> dict:
    """Attach in_use_by_session_id/in_use_by_name/in_use_by_track to each
    device in a fresh /discover response — computed per-request (not cached,
    unlike the device list itself) since claims change far more often than
    the device list. Reports the raw owner regardless of who's asking; the
    frontend decides "claimed by me" vs. "claimed by someone else" by
    comparing against its own session id."""
    annotated: dict = {}
    for group_type, devices in discovered.items():
        annotated[group_type] = []
        for device in devices:
            owner = claims.owner_of(group_type, device["name"])
            owner_session = registry.get(owner) if owner else None
            annotated[group_type].append(
                {
                    **device,
                    "in_use_by_name": owner_session.display_name if owner_session else None,
                    "in_use_by_session_id": owner,
                    "in_use_by_track": track_label(owner_session) if owner_session else None,
                }
            )
    return annotated


@router.get("/discover")
async def discover(fresh: bool = False):
    cached = ctx.discovered
    has_cache = bool(
        cached["sonos"] or cached["airplay"] or cached["chromecast"] or cached["dlna"]
    )

    # fresh=true (explicit "Scan again") awaits a full rescan so the client can
    # show real progress. Otherwise serve cache instantly and rescan in the
    # background for snappy popover opens.
    if has_cache and not fresh:
        asyncio.create_task(discover_all())
        return _annotate_claims(cached)

    return _annotate_claims(await discover_all())


class VolumeRequest(BaseModel):
    volume: int


@router.get("/volume")
async def get_volume(session: SessionState = Depends(get_session)):
    sonos_targets = find_sonos(session.state.active_delivery)
    if not sonos_targets:
        return {"error": "No active Sonos target"}
    try:
        device = await asyncio.to_thread(sonos_targets[0]._get_device)
        return {"volume": device.volume}
    except Exception as e:
        logger.warning(f"[volume] get error: {e}")
        return {"error": str(e)}


@router.post("/volume")
async def set_volume(req: VolumeRequest, session: SessionState = Depends(get_session)):
    volume = max(0, min(100, req.volume))
    sonos_targets = find_sonos(session.state.active_delivery)
    if not sonos_targets:
        return {"error": "No active Sonos target"}

    async def _set(d: SonosDelivery):
        device = await asyncio.to_thread(d._get_device)
        await asyncio.to_thread(setattr, device, "volume", volume)

    await asyncio.gather(*[_set(d) for d in sonos_targets], return_exceptions=True)
    return {"volume": volume}


@router.get("/device-volume")
async def get_device_volume(device_type: str, name: str):
    try:
        if device_type == "sonos":
            device = await asyncio.to_thread(SonosDelivery(name)._get_device)
            return {"volume": device.volume}
        if device_type == "chromecast":
            cast = await asyncio.to_thread(ChromecastDelivery(name)._get_device)
            return {"volume": int(round(cast.status.volume_level * 100))}
        if device_type == "dlna":
            volume = await DlnaDelivery(name).get_volume()
            if volume is None:
                return {"error": f"Volume control not supported for {name}"}
            return {"volume": volume}
        return {"error": f"Volume control not supported for {device_type}"}
    except Exception as e:
        logger.warning(f"[device-volume] get '{name}': {e}")
        return {"error": str(e)}


@router.post("/device-volume")
async def set_device_volume(device_type: str, name: str, req: VolumeRequest):
    volume = max(0, min(100, req.volume))
    try:
        if device_type == "sonos":
            device = await asyncio.to_thread(SonosDelivery(name)._get_device)
            await asyncio.to_thread(setattr, device, "volume", volume)
            return {"volume": volume}
        if device_type == "chromecast":
            cast = await asyncio.to_thread(ChromecastDelivery(name)._get_device)
            await asyncio.to_thread(cast.set_volume, volume / 100.0)
            return {"volume": volume}
        if device_type == "dlna":
            await DlnaDelivery(name).set_volume(volume)
            return {"volume": volume}
        return {"error": f"Volume control not supported for {device_type}"}
    except Exception as e:
        logger.warning(f"[device-volume] set '{name}': {e}")
        return {"error": str(e)}


@router.post("/device-stop")
async def stop_device(
    device_type: str, name: str, session: SessionState = Depends(get_session)
):
    """Stop one device while keeping others playing.

    For Sonos coordinators: unjoins remaining followers first so the coordinator's
    stop command doesn't kill the whole group, then restarts the stream on them.
    """
    type_cls: type[BaseDelivery]
    if device_type == "sonos":
        type_cls = SonosDelivery
    elif device_type == "chromecast":
        type_cls = ChromecastDelivery
    elif device_type == "dlna":
        type_cls = DlnaDelivery
    else:
        type_cls = AirPlayDelivery
    active = session.state.active_delivery

    remaining: list[BaseDelivery] = []
    if isinstance(active, DeliveryManager):
        remaining = [
            d
            for d in active.deliveries
            if not (isinstance(d, type_cls) and d.target == name)
        ]
    elif active and not (isinstance(active, type_cls) and active.target == name):
        remaining = [active]

    logger.info(
        f"[device-stop] {device_type}:{name} — remaining: "
        f"{[d.target for d in remaining] or 'none'}"
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
                    logger.info(
                        f"[device-stop] Ungrouping {len(remaining)} follower(s) …"
                    )
                    for rem in remaining:
                        if isinstance(rem, SonosDelivery):
                            rem_dev = next(
                                (
                                    d
                                    for d in all_soco
                                    if d.player_name.lower() == rem.target.lower()
                                ),
                                None,
                            )
                            if rem_dev:
                                try:
                                    await asyncio.to_thread(rem_dev.unjoin)
                                    logger.debug(
                                        f"[device-stop] {rem.target} ungrouped"
                                    )
                                except Exception as ex:
                                    logger.warning(
                                        f"[device-stop] unjoin {rem.target}: {ex}"
                                    )
                    await asyncio.sleep(0.3)
                    need_restart = True
                elif not is_coord:
                    await asyncio.to_thread(target_dev.unjoin)
                    await asyncio.sleep(0.1)

                await asyncio.to_thread(target_dev.stop)
                logger.info(f"[device-stop] {name} stopped")
            else:
                logger.warning(f"[device-stop] Sonos '{name}' not found on network")
        elif device_type == "chromecast":
            await ChromecastDelivery(name).stop()
        elif device_type == "dlna":
            await DlnaDelivery(name).stop()
        else:
            await AirPlayDelivery(name).stop()

    except Exception as e:
        logger.error(f"[device-stop] {name}: {e}", exc_info=True)
        return {"error": str(e)}

    await claims.release(device_type, name, session.session_id)

    st = session.state
    if not remaining:
        st.is_streaming = False
        st.active_delivery = None
    else:
        new_delivery: BaseDelivery | DeliveryManager = (
            remaining[0]
            if len(remaining) == 1
            else DeliveryManager.from_deliveries(remaining)
        )
        st.active_delivery = new_delivery

        if need_restart and st.is_streaming:
            url = st.radio_info["url"] if st.radio_info else stream_url(session.session_id)
            title = st.radio_info["title"] if st.radio_info else "Connect"
            logger.info(f"[device-stop] Restarting stream: {url}")
            try:
                await new_delivery.play(url, title)
            except Exception as e:
                logger.error(f"[device-stop] Restart error: {e}", exc_info=True)

    await session.event_bus.broadcast(build_status_dict(session))
    return {"status": "stopped", "device": name}


class JoinRequest(BaseModel):
    target_name: str
    target_type: str
    # See PlayRequest.force in routes/playback.py.
    force: bool = False


@router.post("/join")
async def join_stream(
    req: JoinRequest, session: SessionState = Depends(get_session)
):
    st = session.state
    if not st.is_streaming:
        return {"error": "No active stream"}

    type_cls: type[BaseDelivery]
    if req.target_type == "sonos":
        type_cls = SonosDelivery
    elif req.target_type == "chromecast":
        type_cls = ChromecastDelivery
    elif req.target_type == "dlna":
        type_cls = DlnaDelivery
    else:
        type_cls = AirPlayDelivery
    new_d: BaseDelivery = type_cls(req.target_name)

    error, displaced = await check_claims(new_d, session, force=req.force)
    if error:
        return error
    for target_type, name, owner in displaced:
        owner_session = registry.get(owner)
        if owner_session:
            await displace_target(owner_session, target_type, name)

    url = stream_url(session.session_id)
    logger.info(f"[join] {req.target_type}:{req.target_name} → {url}")

    if req.target_type == "sonos":
        existing_sonos = find_sonos(st.active_delivery)
        if existing_sonos:
            try:
                coordinator = await asyncio.to_thread(existing_sonos[0]._get_device)
                joiner = await asyncio.to_thread(new_d._get_device)
                await asyncio.to_thread(joiner.join, coordinator)
                logger.info(
                    f"[join] {req.target_name} joining group of {existing_sonos[0].target}"
                )
            except Exception as e:
                logger.warning(
                    f"[join] Group join failed ({e}), falling back to individual stream"
                )
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
        st.active_delivery = DeliveryManager.from_deliveries(
            [st.active_delivery, new_d]
        )
    else:
        st.active_delivery = new_d

    await session.event_bus.broadcast(build_status_dict(session))
    return {"status": "joined", "device": req.target_name}
