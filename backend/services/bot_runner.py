import uuid

from sqlalchemy import select

from backend.config import decrypt
from backend.database import async_session
from backend.models import GlobalSetting, PlatformSetting
from backend.services import log_service
from backend.services.notification_service import create_notification
from backend.services.run_record_service import finish_bot_run, start_bot_run
from backend.bots.base import BaseBot
from backend.bots.naukri import NaukriBot
from backend.bots.internshala import InternshalaBot
from backend.bots.indeed import IndeedBot
from backend.bots.linkedin import LinkedInBot

BOT_MAP: dict[str, type[BaseBot]] = {
    "naukri": NaukriBot,
    "internshala": InternshalaBot,
    "indeed": IndeedBot,
    "linkedin": LinkedInBot,
}


async def run_platform(platform: str, run_id: str, user_id: int):
    run_row_id: int | None = None
    bot: BaseBot | None = None

    async with async_session() as session:
        ps = await session.execute(
            select(PlatformSetting).where(
                PlatformSetting.platform == platform,
                PlatformSetting.user_id == user_id,
            )
        )
        settings = ps.scalar_one_or_none()
        if not settings or not settings.enabled:
            await log_service.log(session, run_id, platform, "info", f"Skipping {platform} (disabled)", user_id)
            return

        gs = await session.execute(
            select(GlobalSetting).where(GlobalSetting.user_id == user_id)
        )
        global_settings = gs.scalar_one_or_none()
        resume_path = global_settings.resume_path if global_settings else ""

        bot_cls = BOT_MAP.get(platform)
        if not bot_cls:
            await log_service.log(session, run_id, platform, "error", f"No bot for {platform}", user_id)
            return

        bot = bot_cls(
            run_id=run_id,
            username=settings.username,
            password=decrypt(settings.password),
            keywords=settings.keywords,
            role=settings.role,
            location=settings.location,
            daily_limit=settings.daily_limit,
            resume_path=resume_path,
            user_id=user_id,
            experience=settings.experience or "",
        )

        await log_service.log(session, run_id, platform, "info", f"Starting {platform} bot", user_id)
        run_row_id = await start_bot_run(session, run_id, user_id, platform)

    stats = {
        "jobs_found": 0,
        "jobs_applied": 0,
        "jobs_skipped": 0,
        "error_count": 0,
        "success": False,
    }
    status = "failed"
    ok = False

    try:
        if bot:
            stats = await bot.run()
            ok = bool(stats.get("success"))
            status = "completed" if ok else "failed"
    except Exception as e:
        async with async_session() as session:
            await log_service.log(session, run_id, platform, "error", f"Bot crashed: {e}", user_id)
        stats = {
            "jobs_found": 0,
            "jobs_applied": 0,
            "jobs_skipped": 0,
            "error_count": 1,
            "success": False,
        }
        ok = False
        status = "failed"

    if run_row_id is not None:
        async with async_session() as session:
            await log_service.log(
                session,
                run_id,
                platform,
                "info" if ok else "error",
                f"Finished {platform} bot",
                user_id,
            )
            await finish_bot_run(
                session,
                run_row_id,
                status,
                stats.get("jobs_found", 0),
                stats.get("jobs_applied", 0),
                stats.get("jobs_skipped", 0),
                stats.get("error_count", 0),
            )
            title = f"{platform.title()} run {status}"
            msg = (
                f"Found {stats.get('jobs_found', 0)}, applied {stats.get('jobs_applied', 0)}, "
                f"skipped {stats.get('jobs_skipped', 0)}."
            )
            ntype = (
                "success"
                if ok and stats.get("jobs_applied", 0) > 0
                else ("warning" if ok else "error")
            )
            await create_notification(session, user_id, ntype, title, msg)


async def run_all_enabled_platforms(user_id: int):
    run_id = str(uuid.uuid4())[:8]
    async with async_session() as session:
        result = await session.execute(
            select(PlatformSetting.platform).where(
                PlatformSetting.enabled == True,
                PlatformSetting.user_id == user_id,
            )
        )
        platforms = [row[0] for row in result.fetchall()]

    for platform in platforms:
        await run_platform(platform, run_id, user_id)


async def run_selected_platforms(platforms: list[str], user_id: int) -> str:
    run_id = str(uuid.uuid4())[:8]
    for platform in platforms:
        await run_platform(platform, run_id, user_id)
    return run_id
