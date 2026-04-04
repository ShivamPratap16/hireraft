import json
from datetime import datetime, timezone
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

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
    session: AsyncSession,
    run_id: str,
    platform: str,
    level: str,
    message: str,
    user_id: int | None = None,
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
    session.add(entry)
    await session.commit()

    await broadcast({
        "run_id": run_id,
        "platform": platform,
        "level": level,
        "message": message,
        "timestamp": now.isoformat(),
        "user_id": user_id,
    })
