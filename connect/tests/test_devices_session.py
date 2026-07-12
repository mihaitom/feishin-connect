"""Tests for routes/devices.py — /device-stop and /join session mutations."""

from unittest.mock import AsyncMock, patch

import pytest

from delivery import (
    AirPlayDelivery,
    ChromecastDelivery,
    DeliveryManager,
    SonosDelivery,
)


# ── /device-stop ──────────────────────────────────────────────────────────────


def test_device_stop_chromecast_resets_state_when_last(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.active_delivery = ChromecastDelivery("TV")

    with patch.object(ChromecastDelivery, "stop", new=AsyncMock()) as stop:
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert r.status_code == 200
    assert r.json()["status"] == "stopped"
    stop.assert_awaited_once()
    assert default_session.state.is_streaming is False
    assert default_session.state.active_delivery is None


def test_device_stop_chromecast_keeps_remaining_deliveries(client, default_session):
    remaining_sonos = SonosDelivery("Küche")
    default_session.state.is_streaming = True
    default_session.state.active_delivery = DeliveryManager.from_deliveries(
        [ChromecastDelivery("TV"), remaining_sonos]
    )

    with patch.object(ChromecastDelivery, "stop", new=AsyncMock()):
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert r.json()["status"] == "stopped"
    assert default_session.state.is_streaming is True
    assert default_session.state.active_delivery is remaining_sonos


def test_device_stop_airplay_branch(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.active_delivery = AirPlayDelivery("HomePod")

    with patch.object(AirPlayDelivery, "stop", new=AsyncMock()) as stop:
        r = client.post("/device-stop?device_type=airplay&name=HomePod")

    assert r.json()["status"] == "stopped"
    stop.assert_awaited_once()
    assert default_session.state.active_delivery is None


def test_device_stop_returns_error_on_exception(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.active_delivery = ChromecastDelivery("TV")

    with patch.object(
        ChromecastDelivery, "stop", new=AsyncMock(side_effect=RuntimeError("boom"))
    ):
        r = client.post("/device-stop?device_type=chromecast&name=TV")

    assert "error" in r.json()


def test_device_stop_releases_the_claim(client, default_session):
    from core.claims import claims

    default_session.state.is_streaming = True
    default_session.state.active_delivery = ChromecastDelivery("TV")

    import asyncio

    asyncio.run(claims.claim("chromecast", "TV", default_session.session_id))
    assert claims.owner_of("chromecast", "TV") == default_session.session_id

    with patch.object(ChromecastDelivery, "stop", new=AsyncMock()):
        client.post("/device-stop?device_type=chromecast&name=TV")

    assert claims.owner_of("chromecast", "TV") is None


# ── /join ─────────────────────────────────────────────────────────────────────


@pytest.fixture
def _streaming(default_session):
    default_session.state.is_streaming = True
    yield


def test_join_rejected_when_not_streaming(client):
    r = client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})
    assert "error" in r.json()


def test_join_chromecast_plays_and_sets_active(client, default_session, _streaming):
    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "chromecast", "target_name": "TV"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
    assert isinstance(default_session.state.active_delivery, ChromecastDelivery)
    assert default_session.state.active_delivery.target == "TV"


def test_join_airplay_plays_and_sets_active(client, default_session, _streaming):
    with patch.object(AirPlayDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "airplay", "target_name": "HomePod"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
    assert isinstance(default_session.state.active_delivery, AirPlayDelivery)


def test_join_chromecast_appends_to_existing_manager(
    client, default_session, _streaming
):
    existing = AirPlayDelivery("HomePod")
    default_session.state.active_delivery = DeliveryManager.from_deliveries([existing])

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()):
        client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})

    mgr = default_session.state.active_delivery
    assert isinstance(mgr, DeliveryManager)
    assert len(mgr.deliveries) == 2
    assert any(isinstance(d, ChromecastDelivery) for d in mgr.deliveries)


def test_join_chromecast_promotes_single_active_to_manager(
    client, default_session, _streaming
):
    default_session.state.active_delivery = AirPlayDelivery("HomePod")

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()):
        client.post("/join", json={"target_type": "chromecast", "target_name": "TV"})

    mgr = default_session.state.active_delivery
    assert isinstance(mgr, DeliveryManager)
    assert {type(d) for d in mgr.deliveries} == {AirPlayDelivery, ChromecastDelivery}


def test_join_sonos_falls_back_to_individual_play_when_group_fails(
    client, default_session, _streaming
):
    existing_sonos = SonosDelivery("Küche")
    default_session.state.active_delivery = existing_sonos

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


def test_join_sonos_without_existing_sonos_plays_individually(
    client, default_session, _streaming
):
    default_session.state.active_delivery = None

    with patch.object(SonosDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "sonos", "target_name": "Wohnzimmer"}
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()


def test_join_rejected_when_target_claimed_by_another_session(client, _streaming):
    from core.claims import claims

    import asyncio

    asyncio.run(claims.claim("chromecast", "TV", "some-other-session"))

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        r = client.post(
            "/join", json={"target_type": "chromecast", "target_name": "TV"}
        )

    body = r.json()
    assert body["error"] == "device_in_use"
    assert body["device"] == {"name": "TV", "type": "chromecast"}
    play.assert_not_awaited()


def test_join_with_force_displaces_other_sessions_claim(
    client, default_session, _streaming
):
    from core.claims import claims
    from core.session import registry

    import asyncio

    other = asyncio.run(registry.get_or_create("some-other-session"))
    other.state.is_streaming = True
    other_delivery = ChromecastDelivery("TV")
    other.state.active_delivery = other_delivery
    asyncio.run(claims.claim("chromecast", "TV", "some-other-session"))

    with (
        patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play,
        patch.object(ChromecastDelivery, "stop", new=AsyncMock()) as other_stop,
    ):
        r = client.post(
            "/join",
            json={"force": True, "target_type": "chromecast", "target_name": "TV"},
        )

    assert r.json()["status"] == "joined"
    play.assert_awaited_once()
    other_stop.assert_awaited_once()
    assert other.state.active_delivery is None
    assert other.state.is_streaming is False
    assert claims.owner_of("chromecast", "TV") == default_session.session_id
    assert isinstance(default_session.state.active_delivery, ChromecastDelivery)
