"""Shared fixtures for Connect API tests."""

import pytest
from fastapi.testclient import TestClient

import state
from main import app
from subsonic import SubsonicClient


@pytest.fixture
def client():
    """Synchronous TestClient — no network, no real devices needed."""
    with TestClient(app) as c:
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
