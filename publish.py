#!/usr/bin/env python3
"""Publish the Electron app to GitHub releases for the given platform.

Loads GH_TOKEN (and any other vars) from .env if present, then invokes the
matching `pnpm run publish:<platform>` script.

Usage:
    python publish.py [linux|mac|win]
    (default: linux)
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

PLATFORMS = {
    "linux": "publish:linux",
    "mac": "publish:mac",
    "win": "publish:win",
}


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    load_dotenv(root / ".env")

    if not os.environ.get("GH_TOKEN"):
        print("Error: GH_TOKEN is not set (add it to .env)", file=sys.stderr)
        return 1

    platform = argv[1] if len(argv) > 1 else "linux"
    script = PLATFORMS.get(platform)
    if script is None:
        print(f"Usage: {Path(argv[0]).name} [linux|mac|win]", file=sys.stderr)
        return 1

    pnpm = shutil.which("pnpm")
    if pnpm is None:
        print("Error: 'pnpm' not found on PATH", file=sys.stderr)
        return 1

    return subprocess.run([pnpm, "run", script]).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv))
