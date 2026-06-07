"""auth.py — Token-based auth for the Connect API.

A default token is used when CONNECT_TOKEN is not set. It is hardcoded and
publicly known (open source), so it only blocks anonymous scanners — not
anyone who has read the source. Override with CONNECT_TOKEN in docker-compose
for real security.
"""

import os
import secrets

from fastapi import Header, HTTPException, Query

DEFAULT_TOKEN = "feishin-connect-insecure-default"
TOKEN: str = os.getenv("CONNECT_TOKEN", DEFAULT_TOKEN)


def require_token(
    x_connect_token: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> None:
    """FastAPI dependency — enforces CONNECT_TOKEN when configured."""
    if not TOKEN:
        return
    provided = x_connect_token or token
    if not provided or not secrets.compare_digest(provided, TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")
