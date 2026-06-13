"""media/jellyfin.py — Jellyfin API Client

Uses the simple `/Items/{id}/Download` endpoint for streaming (raw file, no
transcoding) — robust for FFmpeg re-streaming to Sonos / AirPlay / Chromecast.
"""

import httpx

from .base import Track

# Jellyfin reports RunTimeTicks in units of 100 ns.
TICKS_PER_SECOND = 10_000_000


class JellyfinClient:
    def __init__(
        self,
        url: str,
        token: str = "",
        user_id: str = "",
        internal_url: str = "",
    ):
        self.base_url = url.rstrip("/")
        self.internal_url = (internal_url or url).rstrip("/")
        self.token = token
        self.user_id = user_id

    def _auth_header(self) -> dict:
        if not self.token:
            return {}
        return {"X-Emby-Token": self.token}

    def _get(self, path: str, **params) -> dict:
        url = f"{self.internal_url}{path}"
        response = httpx.get(
            url, headers=self._auth_header(), params=params, timeout=10
        )
        response.raise_for_status()
        return response.json()

    def get_track(self, track_id: str) -> Track:
        if not self.user_id:
            raise RuntimeError("Jellyfin user_id missing — re-send /config")
        item = self._get(f"/Users/{self.user_id}/Items/{track_id}")
        artists = item.get("Artists") or []
        return Track(
            id=item["Id"],
            title=item.get("Name", "Unknown"),
            artist=", ".join(artists)
            if artists
            else item.get("AlbumArtist", "Unknown"),
            duration=int((item.get("RunTimeTicks") or 0) / TICKS_PER_SECOND),
            # For Jellyfin the cover art id IS the item id (Primary image endpoint).
            cover_art_id=item["Id"],
        )

    def get_stream_url(self, track_id: str) -> str:
        # `/Items/{id}/Download` returns the original file unchanged — FFmpeg
        # handles container/codec conversion downstream.
        return f"{self.internal_url}/Items/{track_id}/Download?api_key={self.token}"

    def get_cover_art_url(self, cover_art_id: str) -> str | None:
        if not cover_art_id or not self.base_url:
            return None
        return f"{self.base_url}/Items/{cover_art_id}/Images/Primary?maxHeight=300"

    def ping(self) -> bool:
        try:
            response = httpx.get(
                f"{self.internal_url}/System/Info/Public",
                timeout=10,
            )
            response.raise_for_status()
            return True
        except Exception:
            return False
