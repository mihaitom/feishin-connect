#!/usr/bin/env python3
"""Build the Connect backend as a standalone binary using PyInstaller.

Output: connect/dist/connect-server/  (included in Electron via extraResources)

Usage:
    python connect/build-binary.py
    OR from the connect directory:
    python build-binary.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str]) -> None:
    print(f"[connect] $ {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    os.chdir(script_dir)

    uv = shutil.which("uv")
    if uv is None:
        print("[connect] ERROR: 'uv' not found on PATH. Install from https://docs.astral.sh/uv/", file=sys.stderr)
        return 1

    print("[connect] Installing dev dependencies (pyinstaller)...")
    run([uv, "sync", "--dev"])

    print("[connect] Running PyInstaller...")
    run([uv, "run", "pyinstaller", "connect-server.spec", "--noconfirm"])

    print(f"[connect] Done — binary at: {script_dir / 'dist' / 'connect-server'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as e:
        print(f"[connect] Command failed with exit code {e.returncode}", file=sys.stderr)
        sys.exit(e.returncode)
