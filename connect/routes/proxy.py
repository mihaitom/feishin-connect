"""routes/proxy.py — transparent proxy for Navidrome API calls

Proxied paths (all routed internally to SERVER_INTERNAL_URL):
  /rest/{path}   → Subsonic API  (navidrome/rest/{path})
  /auth/{path}   → Navidrome Auth (navidrome/auth/{path})
  /{path}        → Navidrome REST API via /api/ nginx prefix (navidrome/api/{path})
                   (nginx strips /api/ before forwarding to the backend)
"""

import os

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])

_INTERNAL_URL = (os.getenv("SERVER_INTERNAL_URL") or os.getenv("NAVIDROME_INTERNAL_URL", "")).rstrip("/")

_SKIP_REQ = {"host", "connection", "transfer-encoding"}
# Strip content-length: httpx decompresses gzip automatically, so the original
# Content-Length no longer matches the actual byte count.
_SKIP_RESP = {"transfer-encoding", "connection", "content-length", "content-encoding"}

_ALL_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]


async def _proxy(request: Request, target: str) -> StreamingResponse | JSONResponse:
    if not _INTERNAL_URL:
        return JSONResponse(
            {"error": "SERVER_INTERNAL_URL not configured"}, status_code=503
        )

    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _SKIP_REQ
    }
    # No gzip from Navidrome: httpx would decompress but forward the original
    # Content-Length → mismatch. Identity prevents this issue.
    fwd_headers["accept-encoding"] = "identity"
    client = httpx.AsyncClient(follow_redirects=True, timeout=60)
    try:
        req = client.build_request(
            method=request.method,
            url=target,
            params=dict(request.query_params),
            headers=fwd_headers,
            content=await request.body(),
        )
        response = await client.send(req, stream=True)
    except httpx.ConnectError as e:
        await client.aclose()
        return JSONResponse({"error": f"Navidrome not reachable: {e}"}, status_code=502)
    except httpx.TimeoutException as e:
        await client.aclose()
        return JSONResponse({"error": f"Navidrome Timeout: {e}"}, status_code=504)

    resp_headers = {
        k: v for k, v in response.headers.items() if k.lower() not in _SKIP_RESP
    }

    async def streamed():
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(
        streamed(),
        status_code=response.status_code,
        headers=resp_headers,
        media_type=response.headers.get("content-type"),
    )


@router.api_route("/rest/{path:path}", methods=_ALL_METHODS)
async def proxy_subsonic(path: str, request: Request):
    return await _proxy(request, f"{_INTERNAL_URL}/rest/{path}")


@router.api_route("/auth/{path:path}", methods=_ALL_METHODS)
async def proxy_auth(path: str, request: Request):
    return await _proxy(request, f"{_INTERNAL_URL}/auth/{path}")


# Catch-all: nginx strips "/api/" before forwarding, so, for example,
# "/api/album" is sent to the backend as "/album" → forward it here to navidrome/api/album.
# Register LAST so that specific Connect routes take precedence.
@router.api_route("/{path:path}", methods=_ALL_METHODS)
async def proxy_navidrome_api(path: str, request: Request):
    return await _proxy(request, f"{_INTERNAL_URL}/api/{path}")
