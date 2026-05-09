"""
sonos_ctrl.py — Sonos Steuerung via SoCo
"""

import logging

logger = logging.getLogger("sonos")


def get_device(room_name: str):
    """Sucht ein Sonos-Gerät nach Raumname."""
    import soco

    devices = list(soco.discover() or [])
    if not devices:
        raise RuntimeError("Keine Sonos-Geräte im Netzwerk gefunden.")

    for d in devices:
        try:
            if d.player_name.lower() == room_name.lower():
                return d
        except Exception:
            pass

    available = [d.player_name for d in devices]
    raise RuntimeError(
        f"Raum '{room_name}' nicht gefunden. Verfügbar: {available}"
    )


def play_stream(stream_url: str, room_name: str, title: str = "Navispot") -> None:
    """Weist Sonos an, den Stream zu spielen."""
    device = get_device(room_name)

    # Wenn Gerät in einer Gruppe ist, brauchen wir den Coordinator
    if not device.is_coordinator:
        coordinator = device.group.coordinator
        logger.info(
            f"[{device.player_name}] ist Gruppenmitglied → "
            f"nutze Coordinator [{coordinator.player_name}]"
        )
        device = coordinator

    # Aktuellen Zustand loggen
    transport_info = device.get_current_transport_info()
    current_state = transport_info.get("current_transport_state", "UNKNOWN")
    logger.info(f"Sonos [{device.player_name}] Zustand: {current_state}")

    # Erst stoppen
    if current_state in ("PLAYING", "PAUSED_PLAYBACK", "TRANSITIONING"):
        logger.info("Stoppe laufende Wiedergabe...")
        device.stop()

    # DIDL-Lite Metadata — Sonos braucht das um den Stream-Typ zu verstehen
    # type=object.item.audioItem.audioBroadcast = Radio/Stream
    metadata = (
        '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
        '<item id="1" parentID="0" restricted="1">'
        f'<dc:title>{title}</dc:title>'
        '<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>'
        f'<res protocolInfo="http-get:*:audio/mpeg:*">{stream_url}</res>'
        '</item>'
        '</DIDL-Lite>'
    )

    logger.info(f"Sonos [{device.player_name}] → SetAVTransportURI: {stream_url}")

    # Direkt über AVTransport (mehr Kontrolle als play_uri)
    device.avTransport.SetAVTransportURI(
        [("InstanceID", 0), ("CurrentURI", stream_url), ("CurrentURIMetaData", metadata)]
    )
    device.avTransport.Play([("InstanceID", 0), ("Speed", 1)])

    logger.info("Play gesendet ✓")


def stop(room_name: str) -> None:
    """Stoppt Sonos."""
    device = get_device(room_name)
    device.stop()
    logger.info(f"Sonos [{device.player_name}] gestoppt.")


def list_devices() -> list[dict]:
    """Gibt alle Sonos-Geräte zurück."""
    import soco

    devices = list(soco.discover() or [])
    return [
        {"name": d.player_name, "ip": d.ip_address}
        for d in devices
    ]