"""Tests for JellyfinClient."""

import httpx
import pytest

from media import JellyfinClient


def _client(
    url="http://proxy:9180", internal_url="", token="tok", user_id="u1"
) -> JellyfinClient:
    return JellyfinClient(url, token=token, user_id=user_id, internal_url=internal_url)


# ── internal_url Fallback ─────────────────────────────────────────────────────


def test_internal_url_defaults_to_base_url():
    c = _client(url="http://jf:8096", internal_url="")
    assert c.internal_url == "http://jf:8096"
    assert c.base_url == "http://jf:8096"


def test_internal_url_set_explicitly():
    c = _client(url="http://proxy:9180", internal_url="http://jf:8096")
    assert c.internal_url == "http://jf:8096"
    assert c.base_url == "http://proxy:9180"


def test_trailing_slash_stripped():
    c = _client(url="http://proxy:9180/", internal_url="http://jf:8096/")
    assert c.base_url == "http://proxy:9180"
    assert c.internal_url == "http://jf:8096"


# ── get_stream_url verwendet internal_url + Download-Endpoint ─────────────────


def test_stream_url_uses_download_endpoint():
    c = _client(url="http://proxy:9180", internal_url="http://jf:8096", token="t0k")
    url = c.get_stream_url("track-123")
    assert url == "http://jf:8096/Items/track-123/Download?api_key=t0k"


def test_stream_url_uses_base_when_no_internal():
    c = _client(url="http://jf:8096", internal_url="", token="abc")
    url = c.get_stream_url("trk")
    assert url.startswith("http://jf:8096/Items/trk/Download")


# ── get_cover_art_url ─────────────────────────────────────────────────────────


def test_cover_art_uses_base_url():
    c = _client(url="http://proxy:9180", internal_url="http://jf:8096")
    url = c.get_cover_art_url("item-1")
    assert url == "http://proxy:9180/Items/item-1/Images/Primary?maxHeight=300"


def test_cover_art_none_when_no_id():
    c = _client()
    assert c.get_cover_art_url("") is None


# ── get_track parses Jellyfin item JSON ───────────────────────────────────────


def test_get_track_parses_item(monkeypatch):
    item = {
        "Id": "abc",
        "Name": "Song Title",
        "Artists": ["Artist A", "Artist B"],
        "AlbumArtist": "Artist A",
        # 180s × 10_000_000 ticks/second
        "RunTimeTicks": 180 * 10_000_000,
    }

    def fake_get(url, headers=None, params=None, timeout=None):
        assert url.endswith("/Users/u1/Items/abc")
        assert headers == {"X-Emby-Token": "tok"}
        return httpx.Response(200, json=item, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    track = _client().get_track("abc")
    assert track.id == "abc"
    assert track.title == "Song Title"
    assert track.artist == "Artist A, Artist B"
    assert track.duration == 180
    # Cover art id == item id for Jellyfin
    assert track.cover_art_id == "abc"


def test_get_track_falls_back_to_album_artist(monkeypatch):
    item = {"Id": "x", "Name": "T", "AlbumArtist": "AA", "RunTimeTicks": 0}

    def fake_get(url, **kwargs):
        return httpx.Response(200, json=item, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    track = _client().get_track("x")
    assert track.artist == "AA"
    assert track.duration == 0


def test_get_track_requires_user_id():
    c = JellyfinClient("http://jf:8096", token="t", user_id="")
    with pytest.raises(RuntimeError, match="user_id"):
        c.get_track("abc")


# ── ping ──────────────────────────────────────────────────────────────────────


def test_ping_hits_public_info(monkeypatch):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        return httpx.Response(200, json={"Id": "server"}, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    c = _client(url="http://proxy:9180", internal_url="http://jf:8096")
    assert c.ping() is True
    assert captured["url"] == "http://jf:8096/System/Info/Public"


def test_ping_returns_false_on_error(monkeypatch):
    def fake_get(url, **kwargs):
        raise httpx.ConnectError("nope")

    monkeypatch.setattr(httpx, "get", fake_get)
    assert _client().ping() is False
