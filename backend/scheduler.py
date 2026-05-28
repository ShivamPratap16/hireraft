from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler: AsyncIOScheduler | None = None


async def scheduled_run():
    from backend.models import GlobalSetting
    from backend.services.bot_runner import run_all_enabled_platforms

    settings = await GlobalSetting.find(GlobalSetting.schedule_enabled == True).to_list()  # noqa: E712
    user_ids = [s.user_id for s in settings if s.user_id]

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
