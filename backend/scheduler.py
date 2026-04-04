from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from sqlalchemy import select

_scheduler: AsyncIOScheduler | None = None


async def scheduled_run():
    from backend.database import async_session
    from backend.models import GlobalSetting
    from backend.services.bot_runner import run_all_enabled_platforms

    async with async_session() as session:
        result = await session.execute(
            select(GlobalSetting.user_id).where(GlobalSetting.schedule_enabled == True)  # noqa: E712
        )
        user_ids = [row[0] for row in result.fetchall() if row[0] is not None]

    for uid in user_ids:
        await run_all_enabled_platforms(uid)


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        scheduled_run,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_auto_apply",
        replace_existing=True,
    )
    _scheduler.start()
    return _scheduler


def reschedule(time_str: str):
    if _scheduler is None:
        return
    hour, minute = map(int, time_str.split(":"))
    _scheduler.reschedule_job(
        "daily_auto_apply",
        trigger=CronTrigger(hour=hour, minute=minute),
    )
