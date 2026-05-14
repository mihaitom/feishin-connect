"""sonos_ctrl.py — Sonos control via SoCo"""

import logging

logger = logging.getLogger("sonos")


def get_device(room_name: str):
    """Find a Sonos device by room name."""
    import soco

    devices = list(soco.discover() or [])
    if not devices:
        raise RuntimeError("No Sonos devices found on the network.")

    for d in devices:
        try:
            if d.player_name.lower() == room_name.lower():
                return d
        except Exception:
            pass

    available = [d.player_name for d in devices]
    raise RuntimeError(f"Room '{room_name}' not found. Available: {available}")


def play_stream(stream_url: str, room_name: str, title: str = "Navispot") -> None:
    """Tell Sonos to play the stream."""
    device = get_device(room_name)

    # If device is in a group, we need the coordinator
    if not device.is_coordinator:
        coordinator = device.group.coordinator
        logger.info(
            f"[{device.player_name}] is a group member → "
            f"using coordinator [{coordinator.player_name}]"
        )
        device = coordinator

    # Log current transport state
    transport_info = device.get_current_transport_info()
    current_state = transport_info.get("current_transport_state", "UNKNOWN")
    logger.info(f"Sonos [{device.player_name}] state: {current_state}")

    # Stop first
    if current_state in ("PLAYING", "PAUSED_PLAYBACK", "TRANSITIONING"):
        logger.info("Stopping current playback...")
        device.stop()

    # DIDL-Lite Metadata — Sonos needs this to understand the stream type
    # type=object.item.audioItem.audioBroadcast = Radio/Stream
    metadata = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="1" parentID="0" restricted="1">'
        f"<dc:title>{title}</dc:title>"
        "<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>"
        f'<res protocolInfo="http-get:*:audio/mpeg:*">{stream_url}</res>'
        "</item>"
        "</DIDL-Lite>"
    )

    logger.info(f"Sonos [{device.player_name}] → SetAVTransportURI: {stream_url}")

    # Direct AVTransport call (more control than play_uri)
    device.avTransport.SetAVTransportURI(
        [
            ("InstanceID", 0),
            ("CurrentURI", stream_url),
            ("CurrentURIMetaData", metadata),
        ]
    )
    device.avTransport.Play([("InstanceID", 0), ("Speed", 1)])

    logger.info("Play sent ✓")


def stop(room_name: str) -> None:
    """Stop Sonos."""
    device = get_device(room_name)
    device.stop()
    logger.info(f"Sonos [{device.player_name}] stopped.")


def list_devices() -> list[dict]:
    """Return all Sonos devices."""
    import soco

    devices = list(soco.discover() or [])
    return [{"name": d.player_name, "ip": d.ip_address} for d in devices]
