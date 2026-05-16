"""
subsonic.py — Navidrome / Subsonic API Client
"""

import hashlib
import secrets
from urllib.parse import parse_qs

import httpx

from media import Track


class SubsonicClient:
    def __init__(
        self,
        url: str,
        user: str = "",
        password: str = "",
        credential: str = "",
        internal_url: str = "",
    ):
        self.base_url = url.rstrip("/")
        self.internal_url = (internal_url or url).rstrip("/")
        self.user = user
        self.password = password
        self._credential = (
            credential  # pre-built Subsonic auth query string from Feishin
        )
        self.app_name = "navispot"
        self.api_version = "1.16.1"

    def _auth_params(self) -> dict:
        if self._credential:
            parsed = parse_qs(self._credential, keep_blank_values=True)
            params = {k: v[0] for k, v in parsed.items()}
            params.setdefault("v", self.api_version)
            params.setdefault("c", self.app_name)
            params.setdefault("f", "json")
            return params
        salt = secrets.token_hex(6)
        token = hashlib.md5(f"{self.password}{salt}".encode()).hexdigest()
        return {
            "u": self.user,
            "t": token,
            "s": salt,
            "v": self.api_version,
            "c": self.app_name,
            "f": "json",
        }

    def _get(self, endpoint: str, **params) -> dict:
        url = f"{self.internal_url}/rest/{endpoint}"
        response = httpx.get(url, params={**self._auth_params(), **params}, timeout=10)
        response.raise_for_status()
        data = response.json()

        subsonic = data.get("subsonic-response", {})
        if subsonic.get("status") != "ok":
            error = subsonic.get("error", {})
            raise RuntimeError(
                f"Subsonic Error {error.get('code')}: {error.get('message')}"
            )

        return subsonic

    def get_track(self, track_id: str) -> Track:
        data = self._get("getSong.view", id=track_id)
        song = data.get("song", {})
        return Track(
            id=song["id"],
            title=song.get("title", "Unknown"),
            artist=song.get("artist", "Unknown"),
            duration=song.get("duration", 0),
            cover_art_id=song.get("coverArt", ""),
        )

    def get_stream_url(self, track_id: str) -> str:
        params = "&".join(f"{k}={v}" for k, v in self._auth_params().items())
        return f"{self.internal_url}/rest/stream.view?id={track_id}&{params}"

    def get_cover_art_url(self, cover_art_id: str) -> str | None:
        if not cover_art_id or not self.base_url:
            return None
        params = "&".join(f"{k}={v}" for k, v in self._auth_params().items())
        return (
            f"{self.base_url}/rest/getCoverArt.view?id={cover_art_id}&size=300&{params}"
        )

    def ping(self) -> bool:
        try:
            self._get("ping.view")
            return True
        except Exception:
            return False
