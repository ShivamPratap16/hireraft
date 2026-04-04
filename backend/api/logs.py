from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import RunLog, User
from backend.schemas import RunLogRead
from backend.services import log_service
from backend.auth import get_current_user

router = APIRouter(tags=["logs"])


@router.get("/logs", response_model=list[RunLogRead])
async def get_logs(
    run_id: str | None = None,
    platform: str | None = None,
    limit: int = 200,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(RunLog).where(RunLog.user_id == user.id).order_by(RunLog.timestamp.desc()).limit(limit)
    if run_id:
        q = q.where(RunLog.run_id == run_id)
    if platform:
        q = q.where(RunLog.platform == platform)

    result = await db.execute(q)
    return [RunLogRead.model_validate(r) for r in result.scalars().all()]


@router.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    await ws.accept()
    log_service.register(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        log_service.unregister(ws)
