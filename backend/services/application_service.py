from datetime import datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Application


async def already_applied(
    session: AsyncSession, job_url: str, user_id: int | None = None
) -> bool:
    conditions = [Application.job_url == job_url]
    if user_id is not None:
        conditions.append(Application.user_id == user_id)
    result = await session.execute(
        select(Application.id).where(and_(*conditions)).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def duplicate_same_job_other_platform(
    session: AsyncSession,
    user_id: int | None,
    job_title: str,
    company_name: str,
    current_platform: str,
) -> bool:
    """True if user already has this job (same title + company) on another platform."""
    if not user_id or not company_name or company_name.strip().lower() in ("", "unknown"):
        return False
    t = job_title.strip().lower()
    c = company_name.strip().lower()
    result = await session.execute(
        select(Application.id).where(
            Application.user_id == user_id,
            func.lower(Application.job_title) == t,
            func.lower(Application.company_name) == c,
            Application.platform != current_platform,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def daily_count(session: AsyncSession, platform: str, user_id: int | None = None) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    conditions = [
        Application.platform == platform,
        Application.applied_at >= today_start,
    ]
    if user_id is not None:
        conditions.append(Application.user_id == user_id)
    result = await session.execute(
        select(func.count(Application.id)).where(*conditions)
    )
    return result.scalar() or 0


async def save_application(
    session: AsyncSession,
    job_title: str,
    company_name: str,
    platform: str,
    job_url: str,
    user_id: int | None = None,
):
    return await save_application_with_status(
        session, job_title, company_name, platform, job_url, "applied", user_id
    )


async def save_application_with_status(
    session: AsyncSession,
    job_title: str,
    company_name: str,
    platform: str,
    job_url: str,
    status: str,
    user_id: int | None = None,
):
    app = Application(
        job_title=job_title,
        company_name=company_name,
        platform=platform,
        job_url=job_url,
        status=status,
        user_id=user_id,
        applied_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app
