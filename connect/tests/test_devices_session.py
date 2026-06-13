"""Tests for routes/devices.py — /device-stop and /join session mutations."""

from unittest.mock import AsyncMock, patch

import pytest

import state
from delivery import (
    AirPlayDelivery,
    ChromecastDelivery,
    DeliveryManager,
    SonosDelivery,
)


# ── /device-stop ──────────────────────────────────────────────────────────────


def test_device_stop_chromecast_resets_state_when_last(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.active_delivery = ChromecastDelivery("TV")

    with patch.object(ChromecastDelivery, "stop", new=AsyncMock()) as stop:
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert r.status_code == 200
    assert r.json()["status"] == "stopped"
    stop.assert_awaited_once()
    assert state.ctx.state.is_streaming is False
    assert state.ctx.state.active_delivery is None


def test_device_stop_chromecast_keeps_remaining_deliveries(client):
    remaining_sonos = SonosDelivery("Küche")
    state.ctx.state.is_streaming = True
    state.ctx.state.active_delivery = DeliveryManager.from_deliveries(
        [ChromecastDelivery("TV"), remaining_sonos]
    )

    with patch.object(ChromecastDelivery, "stop", new=AsyncMock()):
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert r.json()["status"] == "stopped"
    assert state.ctx.state.is_streaming is True
    assert state.ctx.state.active_delivery is remaining_sonos


def test_device_stop_airplay_branch(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.active_delivery = AirPlayDelivery("HomePod")

    with patch.object(AirPlayDelivery, "stop", new=AsyncMock()) as stop:
        r = client.post("/device-stop?device_type=airplay&name=HomePod")

    assert r.json()["status"] == "stopped"
    stop.assert_awaited_once()
    assert state.ctx.state.active_delivery is None


def test_device_stop_returns_error_on_exception(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.active_delivery = ChromecastDelivery("TV")

    with patch.object(
        ChromecastDelivery, "stop", new=AsyncMock(side_effect=RuntimeError("boom"))
    ):
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert "error" in r.json()


# ── /join ─────────────────────────────────────────────────────────────────────


@pytest.fixture
def _streaming():
    state.ctx.state.is_streaming = True
    yield


def test_join_rejected_when_not_streaming(client):
    r = client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})
    assert "error" in r.json()


def test_join_chromecast_plays_and_sets_active(client, _streaming):
    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "chromecast", "target_name": "TV"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
    assert isinstance(state.ctx.state.active_delivery, ChromecastDelivery)
    assert state.ctx.state.active_delivery.target == "TV"


def test_join_airplay_plays_and_sets_active(client, _streaming):
    with patch.object(AirPlayDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "airplay", "target_name": "HomePod"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
    assert isinstance(state.ctx.state.active_delivery, AirPlayDelivery)


def test_join_chromecast_appends_to_existing_manager(client, _streaming):
    existing = AirPlayDelivery("HomePod")
    state.ctx.state.active_delivery = DeliveryManager.from_deliveries([existing])

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()):
        client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})

    mgr = state.ctx.state.active_delivery
    assert isinstance(mgr, DeliveryManager)
    assert len(mgr.deliveries) == 2
    assert any(isinstance(d, ChromecastDelivery) for d in mgr.deliveries)


def test_join_chromecast_promotes_single_active_to_manager(client, _streaming):
    state.ctx.state.active_delivery = AirPlayDelivery("HomePod")

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()):
        client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})

    mgr = state.ctx.state.active_delivery
    assert isinstance(mgr, DeliveryManager)
    assert {type(d) for d in mgr.deliveries} == {AirPlayDelivery, ChromecastDelivery}


def test_join_sonos_falls_back_to_individual_play_when_group_fails(client, _streaming):
    existing_sonos = SonosDelivery("Küche")
    state.ctx.state.active_delivery = existing_sonos

    fallback = AsyncMock()
    with (
        patch.object(
            SonosDelivery, "_get_device", side_effect=RuntimeError("group failed")
        ),
        patch.object(SonosDelivery, "play", new=fallback),
    ):
        r = client.post(
            "/join", json={"target_type": "sonos", "target_name": "Wohnzimmer"}
        )

    assert r.json()["status"] == "joined"
    fallback.assert_awaited_once()


def test_join_sonos_without_existing_sonos_plays_individually(client, _streaming):
    state.ctx.state.active_delivery = None

    with patch.object(SonosDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "sonos", "target_name": "Wohnzimmer"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
