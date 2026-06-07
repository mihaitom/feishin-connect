"""state.py — Shared runtime state and helper functions for Feishin Connect."""

import asyncio
import os
import socket
import time

from delivery import (
    AirPlayDelivery,
    BaseDelivery,
    ChromecastDelivery,
    DeliveryManager,
    SonosDelivery,
)
from media import MediaClient, SubsonicClient, Track

PORT = int(os.getenv("PORT", "9181"))
TARGETS = os.getenv("TARGETS", "")


class AppState:
    def __init__(self):
        self.current_track: Track | None = None
        self.is_streaming: bool = False
        self.is_paused: bool = False
        self.radio_info: dict | None = None
        self.active_delivery: BaseDelivery | DeliveryManager | None = None
        # Wall-clock progress tracking
        self.play_start_time: float = 0.0
        self.paused_elapsed: float = 0.0
        # Seek offset for next /stream reconnect (set by /pause, consumed by /stream)
        self.resume_offset: float = 0.0
        # Incremented on every /play, /play-url, /resume so old stream_with_completion
        # handlers don't fire after a new play has already started.
        self.play_generation: int = 0
        # Set True when a track finishes naturally; cleared by /play, /play-url, /stop.
        # Lets the frontend detect track-end even after SSE reconnect or page reload.
        self.track_ended: bool = False
        # Last successful discovery results — returned immediately on subsequent calls.
        self.discovered: dict = {"airplay": [], "chromecast": [], "sonos": []}


class Context:
    """Mutable singleton holding all shared runtime objects."""

    def __init__(self):
        self.state = AppState()
        # Default is an unconfigured Subsonic client — overwritten by /config
        # with either a Subsonic or Jellyfin client.
        self.media: MediaClient = SubsonicClient("")
        self.delivery = DeliveryManager(TARGETS)


ctx = Context()


# ── Helpers ───────────────────────────────────────────────────────────────────


def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()


def stream_url() -> str:
    return f"http://{get_local_ip()}:{PORT}/stream"


def compute_position() -> float:
    """Return elapsed seconds into the current track, clamped to track duration."""
    st = ctx.state
    if not st.is_streaming or not st.play_start_time:
        return 0.0
    if st.is_paused:
        return st.paused_elapsed
    elapsed = time.time() - st.play_start_time
    if st.current_track:
        return min(elapsed, float(st.current_track.duration))
    return elapsed


def build_status_dict() -> dict:
    """Build the full status payload shared by /status and SSE /events."""
    elapsed = compute_position()
    st = ctx.state

    current_track = None
    if st.current_track:
        t = st.current_track
        current_track = {
            "artist": t.artist,
            "cover_art_url": ctx.media.get_cover_art_url(t.cover_art_id),
            "duration": t.duration,
            "title": t.title,
        }

    if isinstance(st.active_delivery, DeliveryManager):
        targets = st.active_delivery.list_targets()
    elif st.active_delivery is not None:
        targets = [
            {
                "name": st.active_delivery.target,
                "type": type(st.active_delivery)
                .__name__.replace("Delivery", "")
                .lower(),
            }
        ]
    else:
        targets = []

    return {
        "current_track": current_track,
        "current_track_index": 0,
        "elapsed": elapsed,
        "ended": st.track_ended,
        "paused": st.is_paused,
        "radio": st.radio_info,
        "streaming": st.is_streaming,
        "targets": targets,
        "total_tracks": 1 if st.current_track else 0,
    }


class EventBus:
    """Broadcasts state changes to all connected SSE clients."""

    def __init__(self):
        self._queues: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._queues:
            self._queues.remove(q)

    async def broadcast(self) -> None:
        """Push current status to all connected SSE clients."""
        if not self._queues:
            return
        payload = build_status_dict()
        for q in self._queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass  # slow consumer — drop update rather than block


event_bus = EventBus()


_DELIVERY_TYPES: dict[str, type[BaseDelivery]] = {
    "airplay": AirPlayDelivery,
    "chromecast": ChromecastDelivery,
    "sonos": SonosDelivery,
}


def resolve_target(
    targets: list[dict] | None = None,
    target_name: str | None = None,
    target_type: str | None = None,
) -> BaseDelivery | DeliveryManager | None:
    """Resolve one or more targets from a request into a single delivery object."""
    if targets:
        deliveries: list[BaseDelivery] = []
        for t in targets:
            cls = _DELIVERY_TYPES.get(t.get("type"), AirPlayDelivery)
            deliveries.append(cls(t["name"]))
        return DeliveryManager.from_deliveries(deliveries)
    if target_type and target_name:
        cls = _DELIVERY_TYPES.get(target_type, AirPlayDelivery)
        return cls(target_name)
    if ctx.delivery.deliveries:
        return ctx.delivery
    return None


def find_sonos(active: BaseDelivery | DeliveryManager | None) -> list[SonosDelivery]:
    """Return all SonosDelivery objects in the active delivery, or from config."""
    if isinstance(active, SonosDelivery):
        return [active]
    if isinstance(active, DeliveryManager):
        found = [d for d in active.deliveries if isinstance(d, SonosDelivery)]
        if found:
            return found
    return [d for d in ctx.delivery.deliveries if isinstance(d, SonosDelivery)]
