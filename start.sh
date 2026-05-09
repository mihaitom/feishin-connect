#!/bin/sh

# Python backend starten
uv run python main.py &

# nginx im foreground
nginx -g "daemon off;"