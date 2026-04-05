from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from backend.models import RunLog, User
from backend.schemas import RunLogRead
from backend.services import log_service
from backend.auth import get_current_user

router = APIRouter(tags=["logs"])

def _log_to_read(r: RunLog) -> RunLogRead:
    d = r.model_dump()
    d["id"] = str(r.id)
    return RunLogRead(**d)

@router.get("/logs", response_model=list[RunLogRead])
async def get_logs(
    run_id: str | None = None,
    platform: str | None = None,
    limit: int = 200,
    user: User = Depends(get_current_user),
):
    query = {"user_id": str(user.id)}
    if run_id:
        query["run_id"] = run_id
    if platform:
        query["platform"] = platform

    logs = await RunLog.find(query).sort("-timestamp").limit(limit).to_list()
    return [_log_to_read(r) for r in logs]

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
