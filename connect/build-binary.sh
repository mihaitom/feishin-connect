#!/bin/bash
# Build the Connect backend as a standalone binary using PyInstaller.
# Output: connect/dist/connect-server/  (included in Electron via extraResources)
#
# Usage:
#   cd connect && bash build-binary.sh
#   OR from project root:
#   bash connect/build-binary.sh
set -e

cd "$(dirname "$0")"

echo "[connect] Installing dev dependencies (pyinstaller)..."
uv sync --dev

echo "[connect] Running PyInstaller..."
uv run pyinstaller connect-server.spec --noconfirm

echo "[connect] Done — binary at: $(pwd)/dist/connect-server/"
