"""Tests for playback endpoints: /play, /stop, /pause, /resume, /status."""

import time
from unittest.mock import patch

import state
from media import Track


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

    track = Track(id="1", title="Test Song", artist="Test Artist", duration=180, cover_art_id="cover-1")
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
