"""lyrics — Remote lyrics providers for Feishin Connect.

Port of src/main/features/core/lyrics/* (Electron main process) for the web/
Docker build, which has no main process to run those IPC handlers. Only
covers the providers that are plain JSON APIs (no HTML scraping), since the
Connect backend is shipped as a PyInstaller binary and extra native
dependencies (lxml, etc.) would complicate that build across platforms.

Sub-modules:
  lrclib    lrclib.net (LRC plain/synced lyrics)
  simpmusic SimpMusic API (plain/synced lyrics)
  shared    fuzzy search-result ranking
"""

from enum import Enum

from . import lrclib, simpmusic
from .shared import order_search_results


class LyricSource(str, Enum):
    LRCLIB = "lrclib.net"
    SIMPMUSIC = "SimpMusic"


__all__ = [
    "LyricSource",
    "lrclib",
    "order_search_results",
    "simpmusic",
]
