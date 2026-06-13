"""Tests for routes/devices.py — /discover and /device-volume."""

from unittest.mock import AsyncMock, MagicMock, patch

import state
from delivery import ChromecastDelivery, SonosDelivery


# ── /discover ─────────────────────────────────────────────────────────────────


def test_discover_returns_all_three_device_types(client):
    sonos = [{"name": "Küche", "ip": "10.0.0.1"}]
    airplay = [
        {"name": "HomePod", "address": "10.0.0.2", "model": "X", "needs_pairing": True}
    ]
    chromecast = [{"name": "TV", "host": "10.0.0.3", "model": "Chromecast"}]

    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=sonos)),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=airplay)),
        patch(
            "routes.devices.discover_chromecast", new=AsyncMock(return_value=chromecast)
        ),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    body = r.json()
    assert body["sonos"] == sonos
    assert body["airplay"] == airplay
    assert body["chromecast"] == chromecast


def test_discover_returns_cached_results_immediately(client):
    state.ctx.state.discovered = {
        "sonos": [{"name": "Cached"}],
        "airplay": [],
        "chromecast": [],
    }

    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["sonos"] == [{"name": "Cached"}]


def test_discover_keeps_cached_branch_when_scanner_raises(client):
    state.ctx.state.discovered = {
        "sonos": [{"name": "Stale"}],
        "airplay": [],
        "chromecast": [],
    }

    with (
        patch(
            "routes.devices.discover_sonos",
            new=AsyncMock(side_effect=RuntimeError("net")),
        ),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_chromecast", new=AsyncMock(return_value=[])),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["sonos"] == [{"name": "Stale"}]


def test_discover_fresh_scan_when_cache_empty(client):
    with (
        patch("routes.devices.discover_sonos", new=AsyncMock(return_value=[])),
        patch("routes.devices.discover_airplay", new=AsyncMock(return_value=[])),
        patch(
            "routes.devices.discover_chromecast",
            new=AsyncMock(return_value=[{"name": "TV"}]),
        ),
    ):
        r = client.get("/discover")

    assert r.status_code == 200
    assert r.json()["chromecast"] == [{"name": "TV"}]


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
