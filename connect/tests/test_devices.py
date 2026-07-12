"""Tests for routes/devices.py — /discover and /device-volume."""

from unittest.mock import AsyncMock, MagicMock, patch

from core import state
from delivery import ChromecastDelivery, DlnaDelivery, SonosDelivery


def _unclaimed(device: dict) -> dict:
    """/discover annotates every device with claim info — with no claims in
    the registry (the default in tests), all fields are None."""
    return {
        **device,
        "in_use_by_name": None,
        "in_use_by_session_id": None,
        "in_use_by_track": None,
    }


# ── /discover ─────────────────────────────────────────────────────────────────


def test_discover_returns_all_four_device_types(client):
    sonos = [{"name": "Küche", "ip": "10.0.0.1"}]
    airplay = [
        {"name": "HomePod", "address": "10.0.0.2", "model": "X", "needs_pairing": True}
    ]
    chromecast = [{"name": "TV", "host": "10.0.0.3", "model": "Chromecast"}]
    dlna = [{"name": "Receiver", "location": "http://10.0.0.4:1400/desc.xml"}]

    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=sonos)),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=airplay)),
        patch(
            "routes.devices.discover_chromecast", new=AsyncMock(return_value=chromecast)
        ),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=dlna)),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    body = r.json()
    assert body["sonos"] == [_unclaimed(d) for d in sonos]
    assert body["airplay"] == [_unclaimed(d) for d in airplay]
    assert body["chromecast"] == [_unclaimed(d) for d in chromecast]
    assert body["dlna"] == [_unclaimed(d) for d in dlna]


def test_discover_returns_cached_results_immediately(client):
    state.ctx.discovered = {
        "sonos": [{"name": "Cached"}],
        "airplay": [],
        "chromecast": [],
        "dlna": [],
    }

    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["sonos"] == [_unclaimed({"name": "Cached"})]


def test_discover_keeps_cached_branch_when_scanner_raises(client):
    state.ctx.discovered = {
        "sonos": [{"name": "Stale"}],
        "airplay": [],
        "chromecast": [],
        "dlna": [],
    }

    with (
        patch(
            "routes.devices.discover_sonos",
            new=AsyncMock(side_effect=RuntimeError("net")),
        ),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["sonos"] == [_unclaimed({"name": "Stale"})]


def test_discover_fresh_scan_when_cache_empty(client):
    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch(
            "routes.devices.discover_chromecast",
            new=AsyncMock(return_value=[{"name": "TV"}]),
        ),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["chromecast"] == [_unclaimed({"name": "TV"})]


def test_discover_reports_claim_owner(client):
    from core.claims import claims
    from core.session import SessionState, registry
    from media import Track

    owner = SessionState("owner-session")
    owner.display_name = "alice"
    owner.state.current_track = Track("1", "Song Title", "Artist Name", 200, "")
    registry._sessions["owner-session"] = owner

    async def _claim():
        await claims.claim("sonos", "Küche", "owner-session")

    import asyncio

    asyncio.run(_claim())

    with (
        patch(
            "routes.devices.discover_sonos",
            new=AsyncMock(return_value=[{"name": "Küche", "ip": "10.0.0.1"}]),
        ),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    device = r.json()["sonos"][0]
    assert device["in_use_by_session_id"] == "owner-session"
    assert device["in_use_by_name"] == "alice"
    assert device["in_use_by_track"] == "Artist Name - Song Title"


def test_discover_reports_radio_title_as_track_for_claim_owner(client):
    from core.claims import claims
    from core.session import SessionState, registry

    owner = SessionState("owner-session")
    owner.display_name = "alice"
    owner.state.radio_info = {"title": "Radio FM", "url": "http://stream"}
    registry._sessions["owner-session"] = owner

    import asyncio

    asyncio.run(claims.claim("sonos", "Küche", "owner-session"))

    with (
        patch(
            "routes.devices.discover_sonos",
            new=AsyncMock(return_value=[{"name": "Küche", "ip": "10.0.0.1"}]),
        ),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_dlna", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.json()["sonos"][0]["in_use_by_track"] == "Radio FM"


# ── /device-volume GET ────────────────────────────────────────────────────────


def test_device_volume_get_sonos(client):
    dev = MagicMock()
    dev.volume = 42
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        r = client.get("/device-volume?device_type=sonos&name=Küche")
    assert r.json() == {"volume": 42}


def test_device_volume_get_chromecast_maps_0_to_1_to_percent(client):
    cast = MagicMock()
    cast.status.volume_level = 0.37
    with patch.object(ChromecastDelivery, "_get_device", return_value=cast):
        r = client.get("/device-volume?device_type=chromecast&name=TV")
    assert r.json() == {"volume": 37}


def test_device_volume_get_returns_error_for_airplay(client):
    r = client.get("/device-volume?device_type=airplay&name=HomePod")
    assert "error" in r.json()


def test_device_volume_get_dlna(client):
    with patch.object(DlnaDelivery, "get_volume", new=AsyncMock(return_value=64)):
        r = client.get("/device-volume?device_type=dlna&name=Receiver")
    assert r.json() == {"volume": 64}


def test_device_volume_get_dlna_returns_error_when_unsupported(client):
    with patch.object(DlnaDelivery, "get_volume", new=AsyncMock(return_value=None)):
        r = client.get("/device-volume?device_type=dlna&name=Receiver")
    assert "error" in r.json()


def test_device_volume_get_swallows_device_errors(client):
    with patch.object(
        SonosDelivery, "_get_device", side_effect=RuntimeError("offline")
    ):
        r = client.get("/device-volume?device_type=sonos&name=Küche")
    assert "error" in r.json()


# ── /device-volume POST ───────────────────────────────────────────────────────


def test_device_volume_set_sonos_assigns_volume(client):
    dev = MagicMock()
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        r = client.post(
            "/device-volume?device_type=sonos&name=Küche", json={"volume": 55}
        )
    assert r.json() == {"volume": 55}
    assert dev.volume == 55


def test_device_volume_set_chromecast_scales_to_0_to_1(client):
    cast = MagicMock()
    with patch.object(ChromecastDelivery, "_get_device", return_value=cast):
        r = client.post(
            "/device-volume?device_type=chromecast&name=TV", json={"volume": 50}
        )
    assert r.json() == {"volume": 50}
    cast.set_volume.assert_called_once_with(0.5)


def test_device_volume_set_clamps_above_100(client):
    dev = MagicMock()
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        r = client.post(
            "/device-volume?device_type=sonos&name=Küche", json={"volume": 250}
        )
    assert r.json() == {"volume": 100}
    assert dev.volume == 100


def test_device_volume_set_clamps_below_zero(client):
    cast = MagicMock()
    with patch.object(ChromecastDelivery, "_get_device", return_value=cast):
        r = client.post(
            "/device-volume?device_type=chromecast&name=TV", json={"volume": -10}
        )
    assert r.json() == {"volume": 0}
    cast.set_volume.assert_called_once_with(0.0)


def test_device_volume_set_rejects_unsupported_type(client):
    r = client.post(
        "/device-volume?device_type=airplay&name=HomePod", json={"volume": 50}
    )
    assert "error" in r.json()


def test_device_volume_set_dlna(client):
    with patch.object(DlnaDelivery, "set_volume", new=AsyncMock()) as set_volume:
        r = client.post(
            "/device-volume?device_type=dlna&name=Receiver", json={"volume": 70}
        )
    assert r.json() == {"volume": 70}
    set_volume.assert_called_once_with(70)
