"""Tests for POST /config."""

import state


def test_config_sets_navidrome_url(client):
    r = client.post(
        "/config", json={"url": "http://nav:4533", "credential": "token=abc"}
    )
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert state.ctx.navidrome.base_url == "http://nav:4533"


def test_config_updates_credential(client):
    client.post("/config", json={"url": "http://nav:4533", "credential": "old"})
    client.post("/config", json={"url": "http://nav:4533", "credential": "new"})
    assert state.ctx.navidrome._credential == "new"


def test_config_replaces_url(client):
    client.post("/config", json={"url": "http://old:4533", "credential": "x"})
    client.post("/config", json={"url": "http://new:4533", "credential": "x"})
    assert state.ctx.navidrome.base_url == "http://new:4533"
