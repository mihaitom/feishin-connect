"""Tests for SonosDelivery, AirPlayDelivery, ChromecastDelivery and DlnaDelivery."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import delivery.chromecast as _chromecast_mod
import delivery.dlna as _dlna_mod
from delivery import AirPlayDelivery, ChromecastDelivery, DlnaDelivery, SonosDelivery


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
    _chromecast_mod._chromecast_cache.clear()
    yield
    _chromecast_mod._chromecast_cache.clear()


def test_chromecast_cache_returns_connected_device():
    cast = MagicMock()
    cast.socket_client.is_connected = True
    _chromecast_mod._chromecast_cache["tv"] = cast
    assert _chromecast_mod._get_cached_chromecast("TV") is cast


def test_chromecast_cache_evicts_disconnected_device():
    cast = MagicMock()
    cast.socket_client.is_connected = False
    _chromecast_mod._chromecast_cache["tv"] = cast
    assert _chromecast_mod._get_cached_chromecast("TV") is None
    assert "tv" not in _chromecast_mod._chromecast_cache


def test_chromecast_cache_evicts_on_socket_exception():
    cast = MagicMock()
    type(cast.socket_client).is_connected = property(
        lambda self: (_ for _ in ()).throw(RuntimeError("dead"))
    )
    _chromecast_mod._chromecast_cache["tv"] = cast
    assert _chromecast_mod._get_cached_chromecast("TV") is None
    assert "tv" not in _chromecast_mod._chromecast_cache


def test_chromecast_cache_miss_returns_none():
    assert _chromecast_mod._get_cached_chromecast("nope") is None


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
        "http://stream",
        "audio/mpeg",
        title="Title",
        thumb=None,
        metadata={"metadataType": 3, "title": "Title", "artist": ""},
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


# ── DlnaDelivery ──────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clear_dlna_caches():
    _dlna_mod._device_cache.clear()
    _dlna_mod._location_cache.clear()
    yield
    _dlna_mod._device_cache.clear()
    _dlna_mod._location_cache.clear()


def _mock_dmr_device(media_position=None, volume_level=None):
    device = MagicMock()
    device.async_set_transport_uri = AsyncMock()
    device.async_play = AsyncMock()
    device.async_pause = AsyncMock()
    device.async_stop = AsyncMock()
    device.async_update = AsyncMock()
    device.async_set_volume_level = AsyncMock()
    device.media_position = media_position
    device.volume_level = volume_level
    return device


def test_dlna_play_sets_transport_uri_then_plays():
    device = _mock_dmr_device()
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        asyncio.run(d.play("http://stream", "Title", "Artist"))
    device.async_set_transport_uri.assert_called_once_with(
        "http://stream", "Title", {"artist": "Artist"}
    )
    device.async_play.assert_called_once()


def test_dlna_play_without_artist_sends_no_metadata():
    device = _mock_dmr_device()
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        asyncio.run(d.play("http://stream", "Title"))
    device.async_set_transport_uri.assert_called_once_with(
        "http://stream", "Title", None
    )


def test_dlna_pause_resume_stop_delegate_to_device():
    device = _mock_dmr_device()
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        asyncio.run(d.pause())
        asyncio.run(d.resume())
        asyncio.run(d.stop())
    device.async_pause.assert_called_once()
    device.async_play.assert_called_once()
    device.async_stop.assert_called_once()


def test_dlna_get_position_returns_seconds():
    device = _mock_dmr_device(media_position=93)
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        position = asyncio.run(d.get_position())
    assert position == 93.0
    device.async_update.assert_called_once_with(do_ping=False)


def test_dlna_get_position_returns_none_when_unavailable():
    device = _mock_dmr_device(media_position=None)
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        assert asyncio.run(d.get_position()) is None


def test_dlna_get_volume_maps_0_to_1_to_percent():
    device = _mock_dmr_device(volume_level=0.42)
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        assert asyncio.run(d.get_volume()) == 42


def test_dlna_get_volume_returns_none_when_unavailable():
    device = _mock_dmr_device(volume_level=None)
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        assert asyncio.run(d.get_volume()) is None


def test_dlna_set_volume_scales_to_0_to_1():
    device = _mock_dmr_device()
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        asyncio.run(d.set_volume(70))
    device.async_set_volume_level.assert_called_once_with(0.7)


def test_dlna_set_volume_clamps_to_valid_range():
    device = _mock_dmr_device()
    d = DlnaDelivery("Receiver")
    with patch.object(DlnaDelivery, "_get_device", new=AsyncMock(return_value=device)):
        asyncio.run(d.set_volume(250))
        asyncio.run(d.set_volume(-10))
    device.async_set_volume_level.assert_any_call(1.0)
    device.async_set_volume_level.assert_any_call(0.0)


def test_dlna_get_device_uses_cached_location(monkeypatch):
    _dlna_mod._location_cache["receiver"] = "http://10.0.0.4:1400/desc.xml"
    created = _mock_dmr_device()

    async def _fake_create(location):
        assert location == "http://10.0.0.4:1400/desc.xml"
        return created

    monkeypatch.setattr(_dlna_mod, "_create_dmr_device", _fake_create)

    d = DlnaDelivery("Receiver")
    device = asyncio.run(d._get_device())
    assert device is created
    assert _dlna_mod._device_cache["receiver"] is created


def test_dlna_get_device_raises_when_not_found(monkeypatch):
    async def _fake_discover_dlna():
        return []

    import delivery.manager as _manager_mod

    monkeypatch.setattr(_manager_mod, "discover_dlna", _fake_discover_dlna)

    d = DlnaDelivery("Nonexistent")
    with pytest.raises(RuntimeError, match="not found"):
        asyncio.run(d._get_device())


def test_dlna_play_evicts_cache_on_error():
    device = _mock_dmr_device()
    device.async_play.side_effect = RuntimeError("device went away")
    _dlna_mod._device_cache["receiver"] = device

    d = DlnaDelivery("Receiver")
    with pytest.raises(RuntimeError):
        asyncio.run(d.play("http://stream", "Title"))
    assert "receiver" not in _dlna_mod._device_cache
