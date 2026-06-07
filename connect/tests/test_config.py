"""Tests for POST /config."""

import state
from media import JellyfinClient, SubsonicClient


def test_config_sets_subsonic_url(client):
    r = client.post(
        "/config", json={"url": "http://nav:4533", "credential": "token=abc"}
    )
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert isinstance(state.ctx.media, SubsonicClient)
    assert state.ctx.media.base_url == "http://nav:4533"


def test_config_updates_credential(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "old"})
    client.post("/config", json={"url": "http://nav:4533", "credential": "new"})
    assert state.ctx.media._credential == "new"


def test_config_replaces_url(client):
    client.post("/config", json={"url": "http://old:4533", "credential": "x"})
    client.post("/config", json={"url": "http://new:4533", "credential": "x"})
    assert state.ctx.media.base_url == "http://new:4533"


def test_config_explicit_subsonic_type(client):
    r = client.post(
        "/config",
        json={
            "url": "http://nav:4533",
            "credential": "token=abc",
            "server_type": "subsonic",
        },
    )
    assert r.status_code == 200
    assert isinstance(state.ctx.media, SubsonicClient)


def test_config_jellyfin_type_creates_jellyfin_client(client):
    r = client.post(
        "/config",
        json={
            "url": "http://jf:8096",
            "credential": "jf-access-token",
            "server_type": "jellyfin",
            "user_id": "user-guid-abc",
        },
    )
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert isinstance(state.ctx.media, JellyfinClient)
    assert state.ctx.media.base_url == "http://jf:8096"
    assert state.ctx.media.token == "jf-access-token"
    assert state.ctx.media.user_id == "user-guid-abc"


def test_config_switches_between_server_types(client):
    client.post(
        "/config",
        json={"url": "http://nav:4533", "credential": "x", "server_type": "subsonic"},
    )
    assert isinstance(state.ctx.media, SubsonicClient)
    client.post(
        "/config",
        json={
            "url": "http://jf:8096",
            "credential": "tok",
            "server_type": "jellyfin",
            "user_id": "u1",
        },
    )
    assert isinstance(state.ctx.media, JellyfinClient)
