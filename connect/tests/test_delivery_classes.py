"""Tests for SonosDelivery, AirPlayDelivery and ChromecastDelivery."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest

import delivery
from delivery import AirPlayDelivery, ChromecastDelivery, SonosDelivery


# ── SonosDelivery ─────────────────────────────────────────────────────────────


def _mock_sonos_device(is_coordinator=True, transport_state="STOPPED"):
    dev = MagicMock()
    dev.is_coordinator = is_coordinator
    dev.get_current_transport_info.return_value = {
        "current_transport_state": transport_state
    }
    return dev


def test_sonos_play_skips_unjoin_when_coordinator():
    dev = _mock_sonos_device(is_coordinator=True)
    d = SonosDelivery("Küche")
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        asyncio.run(d.play("http://stream", "Title"))
    dev.unjoin.assert_not_called()
    dev.avTransport.SetAVTransportURI.assert_called_once()
    dev.avTransport.Play.assert_called_once()


def test_sonos_play_unjoins_when_follower():
    dev = _mock_sonos_device(is_coordinator=False)
    d = SonosDelivery("Küche")
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        asyncio.run(d.play("http://stream"))
    dev.unjoin.assert_called_once()


def test_sonos_play_stops_active_transport_before_setting_uri():
    dev = _mock_sonos_device(transport_state="PLAYING")
    d = SonosDelivery("Küche")
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        asyncio.run(d.play("http://stream"))
    dev.stop.assert_called_once()


def test_sonos_pause_resume_stop_delegate_to_device():
    dev = MagicMock()
    d = SonosDelivery("Küche")
    with patch.object(SonosDelivery, "_get_device", return_value=dev):
        asyncio.run(d.pause())
        asyncio.run(d.resume())
        asyncio.run(d.stop())
    dev.pause.assert_called_once()
    dev.play.assert_called_once()
    dev.stop.assert_called_once()


# ── AirPlayDelivery ───────────────────────────────────────────────────────────


def test_airplay_init_state():
    d = AirPlayDelivery("HomePod")
    assert d.target == "HomePod"
    assert d._stream_task is None
    assert d._atv is None


def test_airplay_stop_is_safe_without_active_stream():
    d = AirPlayDelivery("HomePod")
    asyncio.run(d.stop())
    assert d._atv is None


def test_airplay_stop_closes_atv_when_no_task():
    d = AirPlayDelivery("HomePod")
    atv = MagicMock()
    atv.close.return_value = []
    d._atv = atv

    asyncio.run(d.stop())

    atv.close.assert_called_once()
    assert d._atv is None


# ── ChromecastDelivery cache ──────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clear_chromecast_cache():
    delivery._chromecast_cache.clear()
    yield
    delivery._chromecast_cache.clear()


def test_chromecast_cache_returns_connected_device():
    cast = MagicMock()
    cast.socket_client.is_connected = True
    delivery._chromecast_cache["tv"] = cast
    assert delivery._get_cached_chromecast("TV") is cast


def test_chromecast_cache_evicts_disconnected_device():
    cast = MagicMock()
    cast.socket_client.is_connected = False
    delivery._chromecast_cache["tv"] = cast
    assert delivery._get_cached_chromecast("TV") is None
    assert "tv" not in delivery._chromecast_cache


def test_chromecast_cache_evicts_on_socket_exception():
    cast = MagicMock()
    type(cast.socket_client).is_connected = property(
        lambda self: (_ for _ in ()).throw(RuntimeError("dead"))
    )
    delivery._chromecast_cache["tv"] = cast
    assert delivery._get_cached_chromecast("TV") is None
    assert "tv" not in delivery._chromecast_cache


def test_chromecast_cache_miss_returns_none():
    assert delivery._get_cached_chromecast("nope") is None


# ── ChromecastDelivery playback ───────────────────────────────────────────────


def _mock_cast():
    cast = MagicMock()
    cast.media_controller = MagicMock()
    return cast


def test_chromecast_play_calls_media_controller():
    cast = _mock_cast()
    d = ChromecastDelivery("TV")
    with patch.object(ChromecastDelivery, "_get_device", return_value=cast):
        asyncio.run(d.play("http://stream", "Title"))
    cast.media_controller.play_media.assert_called_once_with(
        "http://stream", "audio/mpeg"
    )
    cast.media_controller.block_until_active.assert_called_once_with(10)


def test_chromecast_pause_resume_stop_delegate_to_controller():
    cast = _mock_cast()
    d = ChromecastDelivery("TV")
    with patch.object(ChromecastDelivery, "_get_device", return_value=cast):
        asyncio.run(d.pause())
        asyncio.run(d.resume())
        asyncio.run(d.stop())
    cast.media_controller.pause.assert_called_once()
    cast.media_controller.play.assert_called_once()
    cast.media_controller.stop.assert_called_once()
