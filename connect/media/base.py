"""media/base.py — Common Track type and MediaClient protocol.

Both SubsonicClient and JellyfinClient implement MediaClient so the rest of the
backend can stay agnostic about which music server is behind /config.
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class Track:
    id: str
    title: str
    artist: str
    duration: int  # seconds
    cover_art_id: str = field(default="")


@runtime_checkable
class MediaClient(Protocol):
    """Minimal interface every music-server adapter must provide."""

    base_url: str

    def get_track(self, track_id: str) -> Track: ...

    def get_stream_url(self, track_id: str) -> str: ...

    def get_cover_art_url(self, cover_art_id: str) -> str | None: ...

    def ping(self) -> bool: ...
