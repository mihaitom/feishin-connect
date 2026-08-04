"""routes/devices.py — /config, /health, /device-stop

Discovery lives in routes/discovery.py, volume in routes/volume.py, and
/join + /claim in routes/join.py — split out since this file used to mix all
of it together.
"""

import asyncio
import logging
import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_token
from core.claims import claims
from core.session import SessionState, build_status_dict, get_session
from core.state import stream_url

from delivery import (
    AirPlayDelivery,
    BaseDelivery,
    ChromecastDelivery,
    DeliveryManager,
    DlnaDelivery,
    SonosDelivery,
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
    candidates = (
        active.deliveries if isinstance(active, DeliveryManager) else [active] if active else []
    )
    # The actual live instance being stopped, if found — AirPlay in
    # particular needs this: its RAOP stream task/connection live on the
    # instance itself (see delivery/airplay.py), so stopping a freshly
    # constructed AirPlayDelivery(name) below would be a no-op that never
    # touches the real stream, leaving it playing forever.
    matched = next(
        (d for d in candidates if isinstance(d, type_cls) and d.target == name), None
    )
    remaining: list[BaseDelivery] = [d for d in candidates if d is not matched]

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
            await (matched or AirPlayDelivery(name)).stop()

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
