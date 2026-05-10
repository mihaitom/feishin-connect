"""routes/proxy.py — transparenter Proxy für Navidrome API-Calls

Proxied paths (alle gehen intern an NAVIDROME_INTERNAL_URL):
  /rest/{path}   → Subsonic API  (navidrome/rest/{path})
  /auth/{path}   → Navidrome Auth (navidrome/auth/{path})
  /{path}        → Navidrome REST API via /api/ nginx-prefix (navidrome/api/{path})
                   (nginx strippt /api/ vor dem Weiterleiten ans Backend)
"""

import os

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

router = APIRouter()

_INTERNAL_URL = os.getenv("NAVIDROME_INTERNAL_URL", "").rstrip("/")

_SKIP_REQ = {"host", "connection", "transfer-encoding"}
# content-length weglassen: httpx dekomprimiert gzip automatisch, dadurch
# stimmt die originale Content-Length nicht mehr mit den tatsächlichen Bytes überein.
_SKIP_RESP = {"transfer-encoding", "connection", "content-length", "content-encoding"}

_ALL_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]


async def _proxy(request: Request, target: str) -> StreamingResponse | JSONResponse:
    if not _INTERNAL_URL:
        return JSONResponse(
            {"error": "NAVIDROME_INTERNAL_URL not configured"}, status_code=503
        )

    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _SKIP_REQ
    }
    # Kein gzip von Navidrome: httpx würde dekomprimieren, aber den originalen
    # Content-Length weiterleiten → Mismatch. Identity verhindert das Problem.
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
        return JSONResponse({"error": f"Navidrome nicht erreichbar: {e}"}, status_code=502)
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


# Catch-all: nginx strippt /api/ vor dem Weiterleiten, also kommt z.B.
# /api/album als /album ans Backend → hier weiterleiten an navidrome/api/album.
# Registriert ZULETZT damit spezifische Connect-Routen Vorrang haben.
@router.api_route("/{path:path}", methods=_ALL_METHODS)
async def proxy_navidrome_api(path: str, request: Request):
    return await _proxy(request, f"{_INTERNAL_URL}/api/{path}")
