"""state.py — Shared runtime state and helper functions for Feishin Connect."""

import os
import socket
import time

from delivery import AirPlayDelivery, BaseDelivery, DeliveryManager, SonosDelivery
from subsonic import SubsonicClient, Track

PORT = int(os.getenv("PORT", "8765"))
TARGETS = os.getenv("TARGETS", "")


class AppState:
    def __init__(self):
        self.current_tracks: list[Track] = []
        self.is_streaming: bool = False
        self.is_paused: bool = False
        self.current_track_index: int = 0
        self.radio_info: dict | None = None
        self.active_delivery: BaseDelivery | DeliveryManager | None = None
        # Wall-clock progress tracking (unaffected by FFmpeg buffering)
        self.play_start_time: float = 0.0
        self.play_start_index: int = 0
        self.paused_elapsed: float = 0.0


class Context:
    """Mutable singleton holding all shared runtime objects.

    Routes import `ctx` and mutate its attributes directly (e.g. ctx.navidrome = ...).
    This avoids the rebinding problem that comes with plain module-level globals.
    """

    def __init__(self):
        self.state = AppState()
        self.navidrome = SubsonicClient("")
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


def compute_position() -> tuple[int, float]:
    """Return (track_index, elapsed_seconds) from wall-clock time.

    Wall-clock tracking avoids the FFmpeg-buffering distortion that fires
    on_track_start early while the previous track is still buffered.
    """
    st = ctx.state
    if not st.current_tracks or not st.play_start_time:
        return st.current_track_index, 0.0

    elapsed_total = (
        st.paused_elapsed if st.is_paused else time.time() - st.play_start_time
    )

    cum = 0.0
    for i, t in enumerate(st.current_tracks[st.play_start_index:]):
        if elapsed_total < cum + t.duration:
            return st.play_start_index + i, elapsed_total - cum
        cum += t.duration

    last = len(st.current_tracks) - 1
    return last, float(st.current_tracks[last].duration)


def resolve_target(
    targets: list[dict] | None = None,
    target_name: str | None = None,
    target_type: str | None = None,
) -> BaseDelivery | DeliveryManager | None:
    """Resolve one or more targets from a request into a single delivery object."""
    if targets:
        deliveries: list[BaseDelivery] = []
        for t in targets:
            cls = SonosDelivery if t.get("type") == "sonos" else AirPlayDelivery
            deliveries.append(cls(t["name"]))
        return DeliveryManager.from_deliveries(deliveries)
    if target_type and target_name:
        return SonosDelivery(target_name) if target_type == "sonos" else AirPlayDelivery(target_name)
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
