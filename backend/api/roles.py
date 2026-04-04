import asyncio
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Query

from backend.api.roles_fallback import search_roles_local

router = APIRouter(tags=["roles"])

_LIGHTCAST_TOKEN: str | None = None
_LIGHTCAST_TOKEN_EXPIRES_AT: float = 0.0
_TOKEN_LOCK = asyncio.Lock()

AUTH_URL = "https://auth.emsicloud.com/connect/token"
NAAS_TITLES_URL = "https://api.lightcast.io/naas/titles"


def _lightcast_configured() -> bool:
    cid = os.getenv("LIGHTCAST_CLIENT_ID", "").strip()
    csec = os.getenv("LIGHTCAST_CLIENT_SECRET", "").strip()
    return bool(cid and csec)


async def _get_lightcast_token() -> str | None:
    global _LIGHTCAST_TOKEN, _LIGHTCAST_TOKEN_EXPIRES_AT
    if not _lightcast_configured():
        return None
    async with _TOKEN_LOCK:
        now = time.time()
        if _LIGHTCAST_TOKEN and now < _LIGHTCAST_TOKEN_EXPIRES_AT - 60:
            return _LIGHTCAST_TOKEN
        client_id = os.getenv("LIGHTCAST_CLIENT_ID", "").strip()
        client_secret = os.getenv("LIGHTCAST_CLIENT_SECRET", "").strip()
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    AUTH_URL,
                    data={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "grant_type": "client_credentials",
                        "scope": "lightcast_open_free",
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=20.0,
                )
                if r.status_code != 200:
                    return None
                body: dict[str, Any] = r.json()
                token = body.get("access_token")
                if not token:
                    return None
                expires_in = int(body.get("expires_in", 3600))
                _LIGHTCAST_TOKEN = str(token)
                _LIGHTCAST_TOKEN_EXPIRES_AT = now + min(expires_in, 3600)
                return _LIGHTCAST_TOKEN
        except Exception:
            return None


def _parse_lightcast_titles(body: dict[str, Any], limit: int) -> list[str]:
    data = body.get("data")
    if not isinstance(data, dict):
        return []
    names: list[str] = []
    seen: set[str] = set()
    for _key, arr in data.items():
        if not isinstance(arr, list):
            continue
        for item in arr:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            if name and isinstance(name, str) and name.strip():
                n = name.strip()
                ln = n.lower()
                if ln not in seen:
                    seen.add(ln)
                    names.append(n)
                    if len(names) >= limit:
                        return names
    return names


async def _lightcast_search(q: str, limit: int) -> list[str] | None:
    token = await _get_lightcast_token()
    if not token:
        return None
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                NAAS_TITLES_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"terms": [q.strip()], "limit": min(limit, 25)},
                timeout=20.0,
            )
            if r.status_code != 200:
                return None
            body = r.json()
            if not isinstance(body, dict):
                return None
            return _parse_lightcast_titles(body, limit)
    except Exception:
        return None


@router.get("/roles/search")
async def search_roles(q: str = Query("", min_length=0), limit: int = Query(15, le=50)):
    lim = max(1, min(limit, 50))
    if q.strip() and _lightcast_configured():
        remote = await _lightcast_search(q, lim)
        if remote:
            return {"roles": remote, "source": "lightcast"}
    return {"roles": search_roles_local(q, lim), "source": "local"}
