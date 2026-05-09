#!/bin/bash
set -e

if [[ -f .env ]]; then
  export $(grep -v '^#' .env | xargs)
fi

if [[ -z "$GH_TOKEN" ]]; then
  echo "Error: GH_TOKEN is not set (add it to .env)"
  exit 1
fi

PLATFORM="${1:-linux}"

case "$PLATFORM" in
  linux)   pnpm run publish:linux ;;
  mac)     pnpm run publish:mac ;;
  win)     pnpm run publish:win ;;
  *)
    echo "Usage: $0 [linux|mac|win]"
    exit 1
    ;;
esac
