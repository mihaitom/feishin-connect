"""Tests for playback endpoints: /play, /stop, /pause, /resume, /status."""

import time
from unittest.mock import AsyncMock, patch

import state
from delivery import AirPlayDelivery, SonosDelivery
from media import Track
from routes.playback import _apply_position_offset


# ── /status ──────────────────────────────────────────────────────────────────


def test_status_initial(client):
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()
    assert body["streaming"] is False
    assert body["paused"] is False
    assert body["targets"] == []
    assert body["current_track"] is None
    assert body["total_tracks"] == 0


def test_status_reflects_state(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.is_paused = True
    r = client.get("/status")
    body = r.json()
    assert body["streaming"] is True
    assert body["paused"] is True


# ── /play ─────────────────────────────────────────────────────────────────────


def test_play_rejects_when_media_not_configured(client):
    r = client.post("/play", json={"track_ids": ["abc"]})
    assert r.status_code == 200
    assert "error" in r.json()


def test_play_rejects_empty_track_list(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})
    r = client.post("/play", json={"track_ids": []})
    assert "error" in r.json()


def test_play_fetches_track_and_sets_state(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    track = Track(
        id="1",
        title="Test Song",
        artist="Test Artist",
        duration=180,
        cover_art_id="cover-1",
    )
    with patch.object(state.ctx.media, "get_track", return_value=track):
        r = client.post("/play", json={"track_ids": ["1"]})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "playing"
    assert state.ctx.state.is_streaming is True
    assert state.ctx.state.current_track is not None
    assert state.ctx.state.current_track.title == "Test Song"


def test_play_returns_error_for_unfetchable_track(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    with patch.object(
        state.ctx.media, "get_track", side_effect=RuntimeError("not found")
    ):
        r = client.post("/play", json={"track_ids": ["bad"]})

    assert "error" in r.json()


# ── /stop ─────────────────────────────────────────────────────────────────────


def test_stop_resets_state(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.current_track = Track("1", "Song", "Artist", 60, "")

    r = client.post("/stop")
    assert r.status_code == 200
    assert r.json()["status"] == "stopped"
    assert state.ctx.state.is_streaming is False
    assert state.ctx.state.current_track is None


def test_stop_is_idempotent(client):
    r1 = client.post("/stop")
    r2 = client.post("/stop")
    assert r1.json()["status"] == "stopped"
    assert r2.json()["status"] == "stopped"


# ── /pause + /resume ──────────────────────────────────────────────────────────


def test_pause_sets_paused_flag(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time() - 30

    r = client.post("/pause")
    assert r.status_code == 200
    assert r.json()["paused"] is True
    assert state.ctx.state.is_paused is True
    assert state.ctx.state.paused_elapsed > 0


def test_resume_clears_paused_flag(client):
    state.ctx.state.is_paused = True
    state.ctx.state.paused_elapsed = 30.0
    state.ctx.state.play_start_time = time.time() - 30

    r = client.post("/resume")
    assert r.status_code == 200
    assert r.json()["paused"] is False
    assert state.ctx.state.is_paused is False


def test_pause_resume_roundtrip_with_position_offset(client):
    """resume_offset must be the raw position so resume doesn't double-apply
    the device's buffering lag (a negative position_offset)."""
    state.ctx.state.is_streaming = True
    state.ctx.state.current_track = Track("1", "Song", "Artist", 180, "")
    state.ctx.state.play_start_time = time.time() - 30
    state.ctx.state.position_offset = -4.0

    r = client.post("/pause")
    assert r.json()["paused"] is True
    assert abs(state.ctx.state.paused_elapsed - 26.0) < 1.0
    assert abs(state.ctx.state.resume_offset - 30.0) < 1.0

    client.post("/resume")
    assert abs(state.ctx.state.position_offset - (-4.0)) < 0.01


# ── /seek with position_offset ────────────────────────────────────────────────


def test_seek_accounts_for_position_offset(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.current_track = Track("1", "Song", "Artist", 180, "")
    state.ctx.state.position_offset = -4.0

    r = client.post("/seek", json={"position": 50.0})
    assert r.status_code == 200
    # raw wall-clock position should be 50 - (-4) = 54
    assert abs(state.ctx.state.resume_offset - 54.0) < 0.01

    elapsed = state.compute_position()
    assert abs(elapsed - 50.0) < 0.5


def test_seek_near_zero_clamps_raw_position(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.current_track = Track("1", "Song", "Artist", 180, "")
    state.ctx.state.position_offset = 4.0

    client.post("/seek", json={"position": 1.0})
    assert state.ctx.state.resume_offset == 0.0


# ── _apply_position_offset ──────────────────────────────────────────────────────


def test_apply_position_offset_fixed_for_airplay():
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time()
    state.ctx.state.play_generation = 1

    target = AirPlayDelivery("HomePod")
    import asyncio

    asyncio.run(_apply_position_offset(target, generation=1))

    assert state.ctx.state.position_offset == -AirPlayDelivery.FIXED_OFFSET


def test_apply_position_offset_calibrates_for_sonos():
    """Device lags behind the wall clock -> position_offset must be negative."""
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time() - 5.0
    state.ctx.state.play_generation = 1

    target = SonosDelivery("Küche")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(return_value=1.5)):
        asyncio.run(_apply_position_offset(target, generation=1))

    # device is ~1.5s in, wall-clock elapsed ~5.5s (incl. the 0.5s poll delay) -> offset ~-4s
    assert -4.5 < state.ctx.state.position_offset < -3.5


def test_apply_position_offset_abandons_on_track_change():
    state.ctx.state.is_streaming = True
    state.ctx.state.play_start_time = time.time()
    # A new /play already bumped the generation by the time the
    # calibration task gets to run its first poll.
    state.ctx.state.play_generation = 2

    target = SonosDelivery("Küche")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(return_value=5.0)):
        asyncio.run(_apply_position_offset(target, generation=1))

    assert state.ctx.state.position_offset == 0.0
