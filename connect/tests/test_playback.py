"""Tests for playback endpoints: /play, /stop, /pause, /resume, /next, /previous, /status."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import state
from subsonic import Track


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

def test_play_rejects_when_navidrome_not_configured(client):
    r = client.post("/play", json={"track_ids": ["abc"]})
    assert r.status_code == 200
    assert "error" in r.json()


def test_play_rejects_empty_track_list(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})
    r = client.post("/play", json={"track_ids": []})
    assert "error" in r.json()


def test_play_fetches_tracks_and_sets_state(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    mock_track = {
        "id": "1",
        "title": "Test Song",
        "artist": "Test Artist",
        "duration": 180,
        "coverArt": "cover-1",
    }
    with patch.object(
        state.ctx.navidrome, "_get", return_value={"song": mock_track}
    ):
        r = client.post("/play", json={"track_ids": ["1"]})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "playing"
    assert body["tracks"] == 1
    assert state.ctx.state.is_streaming is True
    assert len(state.ctx.state.current_tracks) == 1
    assert state.ctx.state.current_tracks[0].title == "Test Song"


def test_play_skips_unfetchable_tracks(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    good = {"id": "2", "title": "Good", "artist": "A", "duration": 120, "coverArt": ""}

    def _get_side_effect(endpoint, **kwargs):
        if kwargs.get("id") == "bad":
            raise RuntimeError("not found")
        return {"song": good}

    with patch.object(state.ctx.navidrome, "_get", side_effect=_get_side_effect):
        r = client.post("/play", json={"track_ids": ["bad", "2"]})

    assert r.json()["tracks"] == 1


# ── /stop ─────────────────────────────────────────────────────────────────────

def test_stop_resets_state(client):
    state.ctx.state.is_streaming = True
    state.ctx.state.current_tracks = [Track("1", "Song", "Artist", 60, "")]

    r = client.post("/stop")
    assert r.status_code == 200
    assert r.json()["status"] == "stopped"
    assert state.ctx.state.is_streaming is False
    assert state.ctx.state.current_tracks == []


def test_stop_is_idempotent(client):
    r1 = client.post("/stop")
    r2 = client.post("/stop")
    assert r1.json()["status"] == "stopped"
    assert r2.json()["status"] == "stopped"


# ── /pause + /resume ──────────────────────────────────────────────────────────

def test_pause_sets_paused_flag(client):
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


# ── /next + /previous ────────────────────────────────────────────────────────

def _two_track_state():
    """Populate state with two tracks, no active delivery."""
    tracks = [
        Track("1", "Song 1", "Artist", 60, ""),
        Track("2", "Song 2", "Artist", 90, ""),
    ]
    state.ctx.state.current_tracks = tracks
    state.ctx.state.current_track_index = 0
    state.ctx.state.play_start_index = 0
    state.ctx.state.play_start_time = time.time()
    state.ctx.state.active_delivery = None


def test_next_advances_index(client):
    _two_track_state()
    r = client.post("/next")
    assert r.status_code == 200
    assert r.json()["current_track_index"] == 1
    assert state.ctx.state.current_track_index == 1


def test_next_at_last_track_returns_error(client):
    _two_track_state()
    state.ctx.state.current_track_index = 1
    state.ctx.state.play_start_index = 1  # compute_position reads from here
    state.ctx.state.play_start_time = time.time()

    r = client.post("/next")
    assert "error" in r.json()
    assert state.ctx.state.current_track_index == 1  # unchanged


def test_previous_decrements_index(client):
    _two_track_state()
    state.ctx.state.current_track_index = 1
    state.ctx.state.play_start_index = 1
    state.ctx.state.play_start_time = time.time()

    r = client.post("/previous")
    assert r.status_code == 200
    assert r.json()["current_track_index"] == 0


def test_previous_at_first_track_returns_error(client):
    _two_track_state()
    r = client.post("/previous")
    assert "error" in r.json()
    assert state.ctx.state.current_track_index == 0  # unchanged


def test_next_uses_wall_clock_position(client):
    """next/previous must read from compute_position(), not raw current_track_index,
    so manually-skipped tracks don't lose their progress."""
    tracks = [
        Track("1", "Song 1", "Artist", 30, ""),
        Track("2", "Song 2", "Artist", 30, ""),
        Track("3", "Song 3", "Artist", 30, ""),
    ]
    state.ctx.state.current_tracks = tracks
    state.ctx.state.current_track_index = 0
    state.ctx.state.play_start_index = 0
    # Simulate 35s elapsed → we are naturally on track index 1
    state.ctx.state.play_start_time = time.time() - 35
    state.ctx.state.active_delivery = None

    r = client.post("/next")
    # Should jump from computed index 1 → 2, not from raw 0 → 1
    assert r.json()["current_track_index"] == 2
