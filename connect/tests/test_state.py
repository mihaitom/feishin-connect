"""Tests for state helpers: compute_position, resolve_target, find_sonos."""

import time

from core import state
from core.state import compute_position, find_sonos, resolve_target
from media import Track


# ── compute_position ──────────────────────────────────────────────────────────


def _reset():
    st = state.ctx.state
    st.current_track = None
    st.is_streaming = False
    st.clock = state.PlaybackClock()


def test_compute_position_no_track():
    _reset()
    assert compute_position() == 0.0


def test_compute_position_not_streaming():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = False
    assert compute_position() == 0.0


def test_compute_position_no_start_time():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = 0.0
    assert compute_position() == 0.0


def test_compute_position_paused():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 9999
    state.ctx.state.clock.is_paused = True
    state.ctx.state.clock.paused_elapsed = 45.0

    assert abs(compute_position() - 45.0) < 0.1


def test_compute_position_playing():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 30
    state.ctx.state.clock.is_paused = False

    assert abs(compute_position() - 30.0) < 1.0


def test_compute_position_clamps_to_duration():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 60, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 9999
    state.ctx.state.clock.is_paused = False

    assert compute_position() == 60.0


def test_compute_position_applies_position_offset():
    """A device lagging behind the wall clock yields a negative offset,
    which compute_position subtracts back out."""
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 30
    state.ctx.state.clock.is_paused = False
    state.ctx.state.clock.position_offset = -4.0

    assert abs(compute_position() - 26.0) < 1.0


def test_compute_position_offset_clamps_to_zero():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 1
    state.ctx.state.clock.is_paused = False
    state.ctx.state.clock.position_offset = -10.0

    assert compute_position() == 0.0


def test_compute_position_offset_clamps_to_duration():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 30, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.clock.play_start_time = time.time() - 28
    state.ctx.state.clock.is_paused = False
    state.ctx.state.clock.position_offset = 4.0

    assert compute_position() == 30.0


# ── resolve_target ────────────────────────────────────────────────────────────


def test_resolve_target_from_targets_list():
    from delivery import AirPlayDelivery, DeliveryManager, SonosDelivery

    result = resolve_target(
        targets=[
            {"type": "sonos", "name": "Küche"},
            {"type": "airplay", "name": "HomePod"},
        ]
    )
    assert isinstance(result, DeliveryManager)
    assert len(result.deliveries) == 2
    assert isinstance(result.deliveries[0], SonosDelivery)
    assert isinstance(result.deliveries[1], AirPlayDelivery)


def test_resolve_target_single_sonos():
    from delivery import SonosDelivery

    result = resolve_target(target_type="sonos", target_name="Wohnzimmer")
    assert isinstance(result, SonosDelivery)
    assert result.target == "Wohnzimmer"


def test_resolve_target_single_airplay():
    from delivery import AirPlayDelivery

    result = resolve_target(target_type="airplay", target_name="HomePod")
    assert isinstance(result, AirPlayDelivery)
    assert result.target == "HomePod"


def test_resolve_target_single_chromecast():
    from delivery import ChromecastDelivery

    result = resolve_target(target_type="chromecast", target_name="LivingRoom TV")
    assert isinstance(result, ChromecastDelivery)
    assert result.target == "LivingRoom TV"


def test_resolve_target_single_dlna():
    from delivery import DlnaDelivery

    result = resolve_target(target_type="dlna", target_name="Receiver")
    assert isinstance(result, DlnaDelivery)
    assert result.target == "Receiver"


def test_resolve_target_mixed_targets_list():
    from delivery import (
        AirPlayDelivery,
        ChromecastDelivery,
        DeliveryManager,
        DlnaDelivery,
        SonosDelivery,
    )

    result = resolve_target(
        targets=[
            {"type": "sonos", "name": "Küche"},
            {"type": "airplay", "name": "HomePod"},
            {"type": "chromecast", "name": "LivingRoom TV"},
            {"type": "dlna", "name": "Receiver"},
        ]
    )
    assert isinstance(result, DeliveryManager)
    assert len(result.deliveries) == 4
    assert isinstance(result.deliveries[0], SonosDelivery)
    assert isinstance(result.deliveries[1], AirPlayDelivery)
    assert isinstance(result.deliveries[2], ChromecastDelivery)
    assert isinstance(result.deliveries[3], DlnaDelivery)


def test_resolve_target_returns_none_when_no_config():
    result = resolve_target()
    assert result is None


# ── find_sonos ────────────────────────────────────────────────────────────────


def test_find_sonos_from_sonos_delivery():
    from delivery import SonosDelivery

    d = SonosDelivery("Küche")
    result = find_sonos(d)
    assert result == [d]


def test_find_sonos_from_manager():
    from delivery import AirPlayDelivery, DeliveryManager, SonosDelivery

    s = SonosDelivery("Küche")
    a = AirPlayDelivery("HomePod")
    manager = DeliveryManager.from_deliveries([s, a])
    result = find_sonos(manager)
    assert result == [s]


def test_find_sonos_returns_empty_for_airplay_only():
    from delivery import AirPlayDelivery

    result = find_sonos(AirPlayDelivery("HomePod"))
    assert result == []


def test_find_sonos_returns_empty_for_chromecast_only():
    from delivery import ChromecastDelivery

    result = find_sonos(ChromecastDelivery("LivingRoom TV"))
    assert result == []


def test_find_sonos_returns_empty_for_dlna_only():
    from delivery import DlnaDelivery

    result = find_sonos(DlnaDelivery("Receiver"))
    assert result == []


def test_find_sonos_picks_sonos_from_mixed_manager():
    from delivery import (
        AirPlayDelivery,
        ChromecastDelivery,
        DeliveryManager,
        SonosDelivery,
    )

    s = SonosDelivery("Küche")
    manager = DeliveryManager.from_deliveries(
        [AirPlayDelivery("HomePod"), s, ChromecastDelivery("TV")]
    )
    assert find_sonos(manager) == [s]


def test_find_sonos_returns_none_from_empty():
    result = find_sonos(None)
    assert result == []
