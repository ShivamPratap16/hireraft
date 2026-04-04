from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import BotRun, RunLog, User
from backend.schemas import BotRunRead, RunDetailResponse, RunLogRead

router = APIRouter(tags=["runs"])


@router.get("/runs", response_model=dict)
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    where_clause = BotRun.user_id == user.id
    total_q = await db.execute(select(func.count(BotRun.id)).where(where_clause))
    total = total_q.scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(
        select(BotRun)
        .where(where_clause)
        .order_by(BotRun.started_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.scalars().all()
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
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BotRun).where(BotRun.run_id == run_id, BotRun.user_id == user.id)
    )
    run_rows = result.scalars().all()
    if not run_rows:
        raise HTTPException(status_code=404, detail="Run not found")

    log_result = await db.execute(
        select(RunLog)
        .where(RunLog.run_id == run_id, RunLog.user_id == user.id)
        .order_by(RunLog.timestamp.asc())
    )
    logs = log_result.scalars().all()
    return RunDetailResponse(
        run_id=run_id,
        platforms=[BotRunRead.model_validate(r) for r in run_rows],
        logs=[RunLogRead.model_validate(l) for l in logs],
    )
