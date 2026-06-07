"""Shared fixtures for Connect API tests."""

import pytest
from fastapi.testclient import TestClient

import auth
import state
from main import app
from media import SubsonicClient


@pytest.fixture
def client():
    """Synchronous TestClient — no network, no real devices needed.

    Automatically includes X-Connect-Token when CONNECT_TOKEN is set so tests
    pass regardless of whether token auth is enabled in the environment.
    """
    with TestClient(app) as c:
        if auth.TOKEN:
            c.headers.update({"X-Connect-Token": auth.TOKEN})
        yield c


@pytest.fixture(autouse=True)
def reset_state():
    """Wipe all runtime state before each test so tests are isolated."""
    st = state.ctx.state
    st.current_track = None
    st.is_streaming = False
    st.is_paused = False
    st.radio_info = None
    st.active_delivery = None
    st.play_start_time = 0.0
    st.paused_elapsed = 0.0
    st.discovered = {"airplay": [], "chromecast": [], "sonos": []}

    state.ctx.media = SubsonicClient("")
    yield
