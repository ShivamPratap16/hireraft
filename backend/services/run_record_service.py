from datetime import datetime, timezone
from backend.models import BotRun

def utcnow():
    return datetime.now(timezone.utc)

async def start_bot_run(
    run_id: str, user_id: str, platform: str
) -> str:
    row = BotRun(
        run_id=run_id,
        user_id=user_id,
        platform=platform,
        status="running",
        started_at=utcnow(),
    )
    await row.insert()
    return str(row.id)

async def finish_bot_run(
    row_id: str,
    status: str,
    jobs_found: int,
    jobs_applied: int,
    jobs_skipped: int,
    error_count: int,
) -> None:
    from beanie import PydanticObjectId
    bot_run = await BotRun.get(PydanticObjectId(row_id))
    if bot_run:
        bot_run.status = status
        bot_run.jobs_found = jobs_found
        bot_run.jobs_applied = jobs_applied
        bot_run.jobs_skipped = jobs_skipped
        bot_run.error_count = error_count
        bot_run.finished_at = utcnow()
        await bot_run.save()
