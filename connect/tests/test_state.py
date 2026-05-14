"""Tests for state helpers: compute_position, resolve_target, find_sonos."""

import time

import state
from state import compute_position, find_sonos, resolve_target
from subsonic import Track


# ── compute_position ──────────────────────────────────────────────────────────


def _reset():
    st = state.ctx.state
    st.current_track = None
    st.is_streaming = False
    st.is_paused = False
    st.play_start_time = 0.0
    st.paused_elapsed = 0.0
    st.resume_offset = 0.0


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
    state.ctx.state.play_start_time = 0.0
    assert compute_position() == 0.0


def test_compute_position_paused():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time() - 9999
    state.ctx.state.is_paused = True
    state.ctx.state.paused_elapsed = 45.0

    assert abs(compute_position() - 45.0) < 0.1


def test_compute_position_playing():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 180, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time() - 30
    state.ctx.state.is_paused = False

    assert abs(compute_position() - 30.0) < 1.0


def test_compute_position_clamps_to_duration():
    _reset()
    state.ctx.state.current_track = Track("1", "T", "A", 60, "")
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time() - 9999
    state.ctx.state.is_paused = False

    assert compute_position() == 60.0


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


def test_find_sonos_returns_none_from_empty():
    result = find_sonos(None)
    assert result == []
