from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.services import log_service

_scheduler: AsyncIOScheduler | None = None


async def scheduled_run():
    from backend.models import GlobalSetting
    from backend.services.bot_runner import run_all_enabled_platforms

    settings = await GlobalSetting.find(GlobalSetting.schedule_enabled == True).to_list()  # noqa: E712
    user_ids = [s.user_id for s in settings if s.user_id]

    for uid in user_ids:
        await run_all_enabled_platforms(uid)


async def discovery_cycle():
    """Hourly: poll ATS APIs, score new jobs, dispatch matches."""
    from backend.services import discovery_service, matching_service, match_dispatcher

    run_id = f"discovery_cycle:{int(datetime.now(timezone.utc).timestamp())}"
    await log_service.log(run_id, "system", "info", "discovery cycle start", None)

    stats = await discovery_service.sync_all()
    candidates = await matching_service.score_jobs(
        stats.new_job_ids + stats.changed_job_ids
    )
    await match_dispatcher.dispatch(candidates)

    await log_service.log(
        run_id,
        "system",
        "info",
        (
            f"cycle done — {stats.jobs_new} new, {stats.jobs_updated} updated, "
            f"{stats.jobs_closed} closed, {len(candidates)} candidates dispatched"
        ),
        None,
    )


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler()

    # Existing daily LinkedIn-style sweep — unchanged
    _scheduler.add_job(
        scheduled_run,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_auto_apply",
        replace_existing=True,
    )

    # Hourly ATS discovery + match + dispatch
    _scheduler.add_job(
        discovery_cycle,
        trigger=IntervalTrigger(hours=1),
        id="discovery_cycle",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=10),
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
