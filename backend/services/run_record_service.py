from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import BotRun


def utcnow():
    return datetime.now(timezone.utc)


async def start_bot_run(
    session: AsyncSession, run_id: str, user_id: int, platform: str
) -> int:
    row = BotRun(
        run_id=run_id,
        user_id=user_id,
        platform=platform,
        status="running",
        started_at=utcnow(),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row.id


async def finish_bot_run(
    session: AsyncSession,
    row_id: int,
    status: str,
    jobs_found: int,
    jobs_applied: int,
    jobs_skipped: int,
    error_count: int,
) -> None:
    await session.execute(
        update(BotRun)
        .where(BotRun.id == row_id)
        .values(
            finished_at=utcnow(),
            status=status,
            jobs_found=jobs_found,
            jobs_applied=jobs_applied,
            jobs_skipped=jobs_skipped,
            error_count=error_count,
        )
    )
    await session.commit()
