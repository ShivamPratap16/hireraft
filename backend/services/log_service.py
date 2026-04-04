import json
from datetime import datetime, timezone
from fastapi import WebSocket

from backend.models import RunLog

_clients: set[WebSocket] = set()


def register(ws: WebSocket):
    _clients.add(ws)


def unregister(ws: WebSocket):
    _clients.discard(ws)


async def broadcast(data: dict):
    dead: list[WebSocket] = []
    for ws in _clients:
        try:
            await ws.send_text(json.dumps(data, default=str))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _clients.discard(ws)


async def log(
    run_id: str,
    platform: str,
    level: str,
    message: str,
    user_id: str | None = None,
):
    now = datetime.now(timezone.utc)
    entry = RunLog(
        run_id=run_id,
        platform=platform,
        level=level,
        message=message,
        timestamp=now,
        user_id=user_id,
    )
    await entry.insert()

    await broadcast({
        "run_id": run_id,
        "platform": platform,
        "level": level,
        "message": message,
        "timestamp": now.isoformat(),
        "user_id": str(user_id) if user_id else None,
    })
