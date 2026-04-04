from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user
from backend.models import BotRun, RunLog, User
from backend.schemas import BotRunRead, RunDetailResponse, RunLogRead

router = APIRouter(tags=["runs"])


@router.get("/runs", response_model=dict)
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
):
    query = {"user_id": str(user.id)}
    total = await BotRun.find(query).count()
    offset = (page - 1) * page_size
    rows = await BotRun.find(query).sort("-started_at").skip(offset).limit(page_size).to_list()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [BotRunRead.model_validate(r) for r in rows],
    }


@router.get("/runs/{run_id}", response_model=RunDetailResponse)
async def get_run_detail(
    run_id: str,
    user: User = Depends(get_current_user),
):
    run_rows = await BotRun.find({"run_id": run_id, "user_id": str(user.id)}).to_list()
    if not run_rows:
        raise HTTPException(status_code=404, detail="Run not found")

    logs = await RunLog.find({"run_id": run_id, "user_id": str(user.id)}).sort("timestamp").to_list()
    return RunDetailResponse(
        run_id=run_id,
        platforms=[BotRunRead.model_validate(r) for r in run_rows],
        logs=[RunLogRead.model_validate(l) for l in logs],
    )
