"""Tests for state helpers: compute_position, resolve_target, find_sonos."""

import time

import state
from state import compute_position, find_sonos, resolve_target
from subsonic import Track


# ── compute_position ──────────────────────────────────────────────────────────

def test_compute_position_no_tracks():
    idx, elapsed = compute_position()
    assert idx == 0
    assert elapsed == 0.0


def test_compute_position_no_start_time():
    state.ctx.state.current_tracks = [Track("1", "T", "A", 180, "")]
    state.ctx.state.play_start_time = 0.0
    idx, elapsed = compute_position()
    assert idx == 0
    assert elapsed == 0.0


def test_compute_position_paused():
    state.ctx.state.current_tracks = [Track("1", "T", "A", 180, "")]
    state.ctx.state.play_start_time = time.time() - 9999  # far back, doesn't matter
    state.ctx.state.play_start_index = 0
    state.ctx.state.is_paused = True
    state.ctx.state.paused_elapsed = 45.0

    idx, elapsed = compute_position()
    assert idx == 0
    assert abs(elapsed - 45.0) < 0.1


def test_compute_position_playing():
    state.ctx.state.current_tracks = [Track("1", "T", "A", 180, "")]
    state.ctx.state.play_start_time = time.time() - 30
    state.ctx.state.play_start_index = 0
    state.ctx.state.is_paused = False

    idx, elapsed = compute_position()
    assert idx == 0
    assert abs(elapsed - 30.0) < 1.0


def test_compute_position_multi_track():
    tracks = [
        Track("1", "T1", "A", 60, ""),
        Track("2", "T2", "A", 120, ""),
        Track("3", "T3", "A", 90, ""),
    ]
    state.ctx.state.current_tracks = tracks
    state.ctx.state.play_start_index = 0
    # 90s elapsed → past track 1 (60s), 30s into track 2
    state.ctx.state.play_start_time = time.time() - 90
    state.ctx.state.is_paused = False

    idx, elapsed = compute_position()
    assert idx == 1
    assert abs(elapsed - 30.0) < 1.0


def test_compute_position_past_end_clamps_to_last():
    state.ctx.state.current_tracks = [Track("1", "T", "A", 60, "")]
    state.ctx.state.play_start_index = 0
    state.ctx.state.play_start_time = time.time() - 9999  # way past end
    state.ctx.state.is_paused = False

    idx, elapsed = compute_position()
    assert idx == 0  # only one track
    assert elapsed == 60.0


def test_compute_position_from_non_zero_start_index():
    tracks = [
        Track("1", "T1", "A", 60, ""),
        Track("2", "T2", "A", 60, ""),
        Track("3", "T3", "A", 60, ""),
    ]
    state.ctx.state.current_tracks = tracks
    state.ctx.state.play_start_index = 1  # started playing from track 2
    state.ctx.state.play_start_time = time.time() - 30  # 30s into track 2
    state.ctx.state.is_paused = False

    idx, elapsed = compute_position()
    assert idx == 1
    assert abs(elapsed - 30.0) < 1.0


# ── resolve_target ────────────────────────────────────────────────────────────

def test_resolve_target_from_targets_list():
    from delivery import AirPlayDelivery, SonosDelivery
    result = resolve_target(targets=[
        {"type": "sonos", "name": "Küche"},
        {"type": "airplay", "name": "HomePod"},
    ])
    from delivery import DeliveryManager
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
