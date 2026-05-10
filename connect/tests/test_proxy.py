"""Tests für routes/proxy.py — Navidrome-Proxy-Endpunkte."""

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Hilfsfunktion: Proxy-Modul mit gegebener Env-Var neu laden ───────────────

def _reload_proxy(internal_url: str):
    """Proxy-Modul mit gesetzter NAVIDROME_INTERNAL_URL neu importieren."""
    import routes.proxy as proxy_mod
    with patch.dict("os.environ", {"NAVIDROME_INTERNAL_URL": internal_url}):
        importlib.reload(proxy_mod)
    return proxy_mod


# ── /rest/{path} ─────────────────────────────────────────────────────────────

def test_proxy_rest_returns_503_when_no_url_configured(client, monkeypatch):
    monkeypatch.setenv("NAVIDROME_INTERNAL_URL", "")
    import routes.proxy as proxy_mod
    importlib.reload(proxy_mod)

    r = client.get("/rest/ping.view?u=user&t=token&s=salt&v=1.16.1&c=test&f=json")
    assert r.status_code == 503
    assert "error" in r.json()


def test_proxy_auth_returns_503_when_no_url_configured(client, monkeypatch):
    monkeypatch.setenv("NAVIDROME_INTERNAL_URL", "")
    import routes.proxy as proxy_mod
    importlib.reload(proxy_mod)

    r = client.post("/auth/login", json={"username": "user", "password": "pass"})
    assert r.status_code == 503


def test_proxy_navidrome_api_returns_503_when_no_url_configured(client, monkeypatch):
    monkeypatch.setenv("NAVIDROME_INTERNAL_URL", "")
    import routes.proxy as proxy_mod
    importlib.reload(proxy_mod)

    r = client.get("/album")
    assert r.status_code == 503


# ── Pairing-Liste (kein Hardware nötig) ──────────────────────────────────────

def test_pair_list_returns_empty_initially(client):
    import tempfile
    import credentials
    with tempfile.TemporaryDirectory() as d:
        import os
        with patch.object(credentials, "_PATH", os.path.join(d, "c.json")):
            r = client.get("/pair/airplay")
    assert r.status_code == 200
    assert r.json()["paired"] == []


def test_pair_start_returns_404_for_unknown_device(client):
    """Start schlägt fehl wenn Gerät im Netz nicht gefunden wird."""
    async def fake_scan(*args, **kwargs):
        return []

    with patch("pyatv.scan", new=AsyncMock(return_value=[])):
        r = client.post("/pair/airplay/start", json={"name": "NonExistentDevice"})

    assert r.status_code == 404
    assert "error" in r.json()


def test_pair_finish_without_start_returns_400(client):
    r = client.post("/pair/airplay/finish", json={"name": "HomePod"})
    assert r.status_code == 400
    assert "error" in r.json()


def test_unpair_nonexistent_returns_404(client):
    import tempfile
    import credentials
    with tempfile.TemporaryDirectory() as d:
        import os
        with patch.object(credentials, "_PATH", os.path.join(d, "c.json")):
            r = client.delete("/pair/airplay/HomePod")
    assert r.status_code == 404


def test_unpair_existing_returns_success(client):
    import tempfile
    import credentials
    with tempfile.TemporaryDirectory() as d:
        import os
        path = os.path.join(d, "c.json")
        with patch.object(credentials, "_PATH", path):
            credentials.save("HomePod", "some-creds")
            r = client.delete("/pair/airplay/HomePod")
    assert r.status_code == 200
    assert r.json()["success"] is True
