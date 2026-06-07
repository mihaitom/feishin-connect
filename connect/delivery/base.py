"""delivery/base.py — BaseDelivery abstract class"""

from abc import ABC, abstractmethod


class BaseDelivery(ABC):
    def __init__(self, target: str):
        self.target = target

    @abstractmethod
    async def play(self, stream_url: str, title: str = "Connect") -> None:
        """Start stream playback."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop playback."""

    async def pause(self) -> None:
        """Pause playback (optional, default: no-op)."""

    async def resume(self) -> None:
        """Resume playback (optional, default: no-op)."""

    def __repr__(self):
        return f"{self.__class__.__name__}({self.target})"
