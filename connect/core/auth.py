"""core/auth.py — Token-based auth for the Connect API.

When CONNECT_TOKEN is not set, a random token is generated for this process
instead of falling back to a fixed value — a hardcoded default would be
public (open source) and give no real protection. Set CONNECT_TOKEN
explicitly (e.g. in docker-compose) if the token needs to stay stable across
restarts, such as for scripting direct API access outside of nginx.
"""

import os
import secrets

from fastapi import Header, HTTPException, Query

_env_token = os.getenv("CONNECT_TOKEN")
TOKEN_WAS_GENERATED: bool = _env_token is None
TOKEN: str = _env_token if _env_token is not None else secrets.token_hex(32)


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
