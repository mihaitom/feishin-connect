"""Tests for playback endpoints: /play, /stop, /pause, /resume, /status."""

import time
from unittest.mock import AsyncMock, patch

from core.session import compute_position
from delivery import AirPlayDelivery, ChromecastDelivery, SonosDelivery
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


def test_status_reflects_state(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.clock.is_paused = True
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


def test_play_fetches_track_and_sets_state(client, default_session):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    track = Track(
        id="1",
        title="Test Song",
        artist="Test Artist",
        duration=180,
        cover_art_id="cover-1",
    )
    with patch.object(default_session.media, "get_track", return_value=track):
        r = client.post("/play", json={"track_ids": ["1"]})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "playing"
    assert default_session.state.is_streaming is True
    assert default_session.state.current_track is not None
    assert default_session.state.current_track.title == "Test Song"


def test_play_with_start_position_seeds_resume_offset_and_elapsed(
    client, default_session
):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    track = Track(
        id="1",
        title="Test Song",
        artist="Test Artist",
        duration=180,
        cover_art_id="cover-1",
    )
    with patch.object(default_session.media, "get_track", return_value=track):
        r = client.post("/play", json={"track_ids": ["1"], "start_position": 42.0})

    assert r.status_code == 200
    assert default_session.state.clock.resume_offset == 42.0
    elapsed = compute_position(default_session)
    assert 41.5 < elapsed <= 42.0 + 0.5


def test_play_clamps_start_position_to_track_duration(client, default_session):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    track = Track(
        id="1",
        title="Test Song",
        artist="Test Artist",
        duration=180,
        cover_art_id="cover-1",
    )
    with patch.object(default_session.media, "get_track", return_value=track):
        r = client.post("/play", json={"track_ids": ["1"], "start_position": 999.0})

    assert r.status_code == 200
    assert default_session.state.clock.resume_offset == 180.0


def test_play_returns_error_for_unfetchable_track(client, default_session):
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})

    with patch.object(
        default_session.media, "get_track", side_effect=RuntimeError("not found")
    ):
        r = client.post("/play", json={"track_ids": ["bad"]})

    assert "error" in r.json()


# ── Phase 2 takeover (force=True) ───────────────────────────────────────────


def test_play_url_rejects_claimed_target_without_force(client, default_session, caplog):
    import asyncio
    import logging

    from core.claims import claims

    asyncio.run(claims.claim("chromecast", "TV", "other-session"))

    with caplog.at_level(logging.INFO, logger="connect.playback"):
        r = client.post(
            "/play-url",
            json={
                "target_name": "TV",
                "target_type": "chromecast",
                "title": "Test",
                "url": "http://example.com/stream.mp3",
            },
        )

    body = r.json()
    assert body["error"] == "device_in_use"
    assert default_session.state.is_streaming is False
    # Logged even when refused — a radio start attempt shouldn't go
    # completely silent just because the device was already claimed.
    messages = "\n".join(rec.message for rec in caplog.records)
    assert "Radio 'Test'" in messages


def test_play_url_with_force_displaces_other_sessions_claim(client, default_session):
    import asyncio

    from core.claims import claims
    from core.session import registry
    from delivery import ChromecastDelivery

    other = asyncio.run(registry.get_or_create("other-session"))
    other.state.is_streaming = True
    other_delivery = ChromecastDelivery("TV")
    other.state.active_delivery = other_delivery
    asyncio.run(claims.claim("chromecast", "TV", "other-session"))

    with (
        patch.object(ChromecastDelivery, "play", new=AsyncMock()),
        patch.object(ChromecastDelivery, "stop", new=AsyncMock()) as other_stop,
    ):
        r = client.post(
            "/play-url",
            json={
                "force": True,
                "target_name": "TV",
                "target_type": "chromecast",
                "title": "Test",
                "url": "http://example.com/stream.mp3",
            },
        )

    assert r.json()["status"] == "playing"
    other_stop.assert_awaited_once()
    assert other.state.active_delivery is None
    assert other.state.is_streaming is False
    assert claims.owner_of("chromecast", "TV") == default_session.session_id


# ── /stop ─────────────────────────────────────────────────────────────────────


def test_stop_resets_state(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.current_track = Track("1", "Song", "Artist", 60, "")

    r = client.post("/stop")
    assert r.status_code == 200
    assert r.json()["status"] == "stopped"
    assert default_session.state.is_streaming is False
    assert default_session.state.current_track is None


def test_stop_is_idempotent(client):
    r1 = client.post("/stop")
    r2 = client.post("/stop")
    assert r1.json()["status"] == "stopped"
    assert r2.json()["status"] == "stopped"


def test_stop_sets_stopped_flag(client, default_session):
    client.post("/stop")
    assert default_session.state.stopped is True


def test_play_clears_stopped_flag(client, default_session):
    default_session.state.stopped = True
    client.post("/config", json={"url": "http://nav:4533", "credential": "x"})
    with patch.object(
        default_session.media,
        "get_track",
        return_value=Track("1", "Song", "Artist", 60, ""),
    ):
        client.post("/play", json={"track_ids": ["1"]})
    assert default_session.state.stopped is False


# ── /queue ────────────────────────────────────────────────────────────────────


def test_queue_sets_track_ids_and_index(client, default_session):
    r = client.post("/queue", json={"track_ids": ["a", "b", "c"], "index": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["queue_index"] == 1
    assert body["total_tracks"] == 3
    assert default_session.state.queue_track_ids == ["a", "b", "c"]
    assert default_session.state.queue_index == 1


def test_queue_clamps_out_of_range_index(client, default_session):
    r = client.post("/queue", json={"track_ids": ["a", "b"], "index": 99})
    assert r.json()["queue_index"] == 1


def test_queue_empty_track_ids_resets_index_to_zero(client, default_session):
    default_session.state.queue_track_ids = ["a"]
    default_session.state.queue_index = 0
    r = client.post("/queue", json={"track_ids": [], "index": 5})
    assert r.json()["queue_index"] == 0
    assert default_session.state.queue_track_ids == []


def test_status_reflects_synced_queue(client, default_session):
    default_session.state.queue_track_ids = ["a", "b", "c"]
    default_session.state.queue_index = 2
    r = client.get("/status")
    body = r.json()
    assert body["queue_track_ids"] == ["a", "b", "c"]
    assert body["current_track_index"] == 2
    assert body["total_tracks"] == 3


def test_status_falls_back_to_single_track_shape_without_synced_queue(
    client, default_session
):
    """Regression test: before a client ever calls /queue (e.g. an older
    frontend, or the pre-existing cast-only flow), total_tracks/
    current_track_index must keep reflecting current_track alone, not 0."""
    default_session.state.current_track = Track("1", "Song", "Artist", 60, "")
    r = client.get("/status")
    body = r.json()
    assert body["queue_track_ids"] == []
    assert body["current_track_index"] == 0
    assert body["total_tracks"] == 1


# ── /next, /prev ──────────────────────────────────────────────────────────────


def _queue_track(track_id: str):
    return Track(track_id, f"Song {track_id}", "Artist", 180, "")


def test_next_advances_and_starts_playback(client, default_session):
    default_session.state.queue_track_ids = ["1", "2", "3"]
    default_session.state.queue_index = 0
    with patch.object(default_session.media, "get_track", side_effect=_queue_track):
        r = client.post("/next", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "playing"
    assert default_session.state.queue_index == 1
    assert default_session.state.current_track.id == "2"
    assert default_session.state.is_streaming is True


def test_prev_moves_back_and_starts_playback(client, default_session):
    default_session.state.queue_track_ids = ["1", "2", "3"]
    default_session.state.queue_index = 2
    with patch.object(default_session.media, "get_track", side_effect=_queue_track):
        r = client.post("/prev", json={})
    assert r.json()["status"] == "playing"
    assert default_session.state.queue_index == 1
    assert default_session.state.current_track.id == "2"


def test_next_at_end_of_queue_returns_error_and_does_not_advance(
    client, default_session
):
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 1
    r = client.post("/next", json={})
    assert "error" in r.json()
    assert default_session.state.queue_index == 1


def test_prev_at_start_of_queue_returns_error_and_does_not_advance(
    client, default_session
):
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 0
    r = client.post("/prev", json={})
    assert "error" in r.json()
    assert default_session.state.queue_index == 0


def test_next_prev_on_empty_queue_return_error(client, default_session):
    assert "error" in client.post("/next", json={}).json()
    assert "error" in client.post("/prev", json={}).json()


def test_next_reuses_active_delivery_as_target(client, default_session):
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 0
    delivery = ChromecastDelivery("TV")
    default_session.state.active_delivery = delivery

    with (
        patch.object(default_session.media, "get_track", side_effect=_queue_track),
        patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play,
    ):
        r = client.post("/next", json={})

    assert r.json()["status"] == "playing"
    play.assert_awaited_once()


# ── /next, /prev: stop-vs-auto-advance race (see AppState.stopped) ───────────


def test_explicit_next_starts_playback_even_if_stopped(client, default_session):
    """An explicit (non-auto) next/prev press always plays — only an
    auto-advance call defers to `stopped`."""
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 0
    default_session.state.stopped = True

    with patch.object(default_session.media, "get_track", side_effect=_queue_track):
        r = client.post("/next", json={"auto": False})

    assert r.json()["status"] == "playing"
    assert default_session.state.is_streaming is True
    assert default_session.state.stopped is False


def test_auto_next_after_stop_does_not_revive_playback(client, default_session):
    """Regression test for the race the user flagged: the current track ends
    naturally right after an explicit /stop — auto-advance must update the
    queue pointer/current track for display but must NOT start playback."""
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 0
    default_session.state.stopped = True
    default_session.state.is_streaming = False

    with patch.object(default_session.media, "get_track", side_effect=_queue_track):
        r = client.post("/next", json={"auto": True})

    assert r.json() == {"advanced": True, "status": "paused"}
    assert default_session.state.queue_index == 1
    assert default_session.state.current_track.id == "2"
    assert default_session.state.is_streaming is False
    assert default_session.state.stopped is True


def test_auto_next_without_stop_advances_and_plays_normally(client, default_session):
    default_session.state.queue_track_ids = ["1", "2"]
    default_session.state.queue_index = 0
    default_session.state.stopped = False

    with patch.object(default_session.media, "get_track", side_effect=_queue_track):
        r = client.post("/next", json={"auto": True})

    assert r.json()["status"] == "playing"
    assert default_session.state.is_streaming is True


# ── /pause + /resume ──────────────────────────────────────────────────────────


def test_pause_sets_paused_flag(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time() - 30

    r = client.post("/pause")
    assert r.status_code == 200
    assert r.json()["paused"] is True
    assert default_session.state.clock.is_paused is True
    assert default_session.state.clock.paused_elapsed > 0


def test_resume_clears_paused_flag(client, default_session):
    default_session.state.clock.is_paused = True
    default_session.state.clock.paused_elapsed = 30.0
    default_session.state.clock.play_start_time = time.time() - 30

    r = client.post("/resume")
    assert r.status_code == 200
    assert r.json()["paused"] is False
    assert default_session.state.clock.is_paused is False


def test_pause_resume_roundtrip_with_position_offset(client, default_session):
    """resume_offset must be the raw position so resume doesn't double-apply
    the device's buffering lag (a negative position_offset)."""
    default_session.state.is_streaming = True
    default_session.state.current_track = Track("1", "Song", "Artist", 180, "")
    default_session.state.clock.play_start_time = time.time() - 30
    default_session.state.clock.position_offset = -4.0

    r = client.post("/pause")
    assert r.json()["paused"] is True
    assert abs(default_session.state.clock.paused_elapsed - 26.0) < 1.0
    assert abs(default_session.state.clock.resume_offset - 30.0) < 1.0

    client.post("/resume")
    assert abs(default_session.state.clock.position_offset - (-4.0)) < 0.01


# ── /seek with position_offset ────────────────────────────────────────────────


def test_seek_accounts_for_position_offset(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.current_track = Track("1", "Song", "Artist", 180, "")
    default_session.state.clock.position_offset = -4.0

    r = client.post("/seek", json={"position": 50.0})
    assert r.status_code == 200
    # raw wall-clock position should be 50 - (-4) = 54
    assert abs(default_session.state.clock.resume_offset - 54.0) < 0.01

    elapsed = compute_position(default_session)
    assert abs(elapsed - 50.0) < 0.5


def test_seek_near_zero_clamps_raw_position(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.current_track = Track("1", "Song", "Artist", 180, "")
    default_session.state.clock.position_offset = 4.0

    client.post("/seek", json={"position": 1.0})
    assert default_session.state.clock.resume_offset == 0.0


# ── /resume + /seek reconnect to radio's own URL, not the track /stream proxy ──
# Radio has no track loaded (current_track stays None — see /play-url), so
# reconnecting via the FFmpeg /stream/{session_id} proxy 204s with nothing to
# play. Regression coverage for that: both must replay radio_info["url"].


def test_resume_reconnects_to_radio_url_not_stream_proxy(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.radio_info = {
        "title": "Radio FM",
        "url": "http://stream/radio",
    }
    default_session.state.active_delivery = ChromecastDelivery("TV")
    default_session.state.clock.is_paused = True

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        r = client.post("/resume")

    assert r.status_code == 200
    play.assert_awaited_once_with("http://stream/radio", "Radio FM", "", None, None, "")


def test_seek_while_playing_reconnects_to_radio_url(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.radio_info = {
        "title": "Radio FM",
        "url": "http://stream/radio",
    }
    default_session.state.active_delivery = ChromecastDelivery("TV")
    default_session.state.clock.is_paused = False

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        client.post("/seek", json={"position": 0})

    play.assert_awaited_once_with("http://stream/radio", "Radio FM", "", None, None, "")


def test_resume_still_uses_stream_proxy_for_a_regular_track(client, default_session):
    default_session.state.is_streaming = True
    default_session.state.current_track = Track("1", "Song", "Artist", 180, "")
    default_session.state.active_delivery = ChromecastDelivery("TV")
    default_session.state.clock.is_paused = True

    with patch.object(ChromecastDelivery, "play", new=AsyncMock()) as play:
        client.post("/resume")

    url = play.call_args.args[0]
    assert url.startswith("http://") and "/stream/" in url


# ── _apply_position_offset ──────────────────────────────────────────────────────


def test_apply_position_offset_fixed_for_airplay(default_session):
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time()
    default_session.state.clock.play_generation = 1

    target = AirPlayDelivery("HomePod")
    import asyncio

    asyncio.run(_apply_position_offset(default_session, target, generation=1))

    assert default_session.state.clock.position_offset == -AirPlayDelivery.FIXED_OFFSET


def test_apply_position_offset_calibrates_for_sonos(default_session):
    """Device lags behind the wall clock -> position_offset must be negative."""
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time() - 5.0
    default_session.state.clock.play_generation = 1

    target = SonosDelivery("Küche")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(return_value=1.5)):
        asyncio.run(_apply_position_offset(default_session, target, generation=1))

    # device is ~1.5s in, wall-clock elapsed ~5.5s (incl. the 0.5s poll delay) -> offset ~-4s
    assert -4.5 < default_session.state.clock.position_offset < -3.5


def test_apply_position_offset_ignores_implausible_reading_then_calibrates(
    default_session,
):
    """Regression test: a device reporting a position far ahead of the wall
    clock this early (observed with a DLNA renderer reporting a stale ~56s
    reading mere seconds into a brand new stream) must not get calibrated in
    as a bogus large offset — keep polling for a plausible reading instead."""
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time()
    default_session.state.clock.play_generation = 1

    target = SonosDelivery("Wohnzimmer")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(side_effect=[56.0, 1.5])):
        asyncio.run(_apply_position_offset(default_session, target, generation=1))

    # Must have used the second (plausible) reading, not the bogus first one —
    # a -53s-ish offset would mean this assertion range is wrong.
    assert -1.5 < default_session.state.clock.position_offset < 1.5


def test_apply_position_offset_calibrates_correctly_with_start_position(
    default_session,
):
    """Regression test: connecting mid-track (start_position > 0) must not
    corrupt the calibration. device_pos is relative to the post-seek FFmpeg
    stream (starts near 0), not to the track, so it must be compared against
    wall-clock time since the stream was requested — not since track-relative
    play_start_time, which is backdated by start_position.
    """
    start_position = 10.0
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time() - start_position
    default_session.state.clock.track_start_position = start_position
    default_session.state.clock.play_generation = 1

    target = SonosDelivery("Arbeitszimmer")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(return_value=1.0)):
        asyncio.run(_apply_position_offset(default_session, target, generation=1))

    # device is ~1s into the post-seek stream, ~0.5s of that is the poll delay
    # -> offset should be a small buffering correction, NOT ~-start_position (-10s).
    assert -2.0 < default_session.state.clock.position_offset < 2.0


def test_apply_position_offset_abandons_on_track_change(default_session):
    default_session.state.is_streaming = True
    default_session.state.clock.play_start_time = time.time()
    # A new /play already bumped the generation by the time the
    # calibration task gets to run its first poll.
    default_session.state.clock.play_generation = 2

    target = SonosDelivery("Küche")
    import asyncio

    with patch.object(target, "get_position", new=AsyncMock(return_value=5.0)):
        asyncio.run(_apply_position_offset(default_session, target, generation=1))

    assert default_session.state.clock.position_offset == 0.0
