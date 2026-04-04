from datetime import datetime, timezone
from backend.models import Application

async def already_applied(job_url: str, user_id: str | None = None) -> bool:
    query = {"job_url": job_url}
    if user_id:
        query["user_id"] = user_id
    count = await Application.find(query).count()
    return count > 0


async def duplicate_same_job_other_platform(
    user_id: str | None,
    job_title: str,
    company_name: str,
    current_platform: str,
) -> bool:
    if not user_id or not company_name or company_name.strip().lower() in ("", "unknown"):
        return False
    t = job_title.strip()
    c = company_name.strip()
    query = {
        "user_id": user_id,
        "job_title": {"$regex": f"^{t}$", "$options": "i"},
        "company_name": {"$regex": f"^{c}$", "$options": "i"},
        "platform": {"$ne": current_platform}
    }
    
    count = await Application.find(query).count()
    return count > 0


async def daily_count(platform: str, user_id: str | None = None) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query = {
        "platform": platform,
        "applied_at": {"$gte": today_start}
    }
    if user_id:
        query["user_id"] = user_id
    return await Application.find(query).count()


async def save_application(
    job_title: str,
    company_name: str,
    platform: str,
    job_url: str,
    user_id: str | None = None,
):
    return await save_application_with_status(
        job_title, company_name, platform, job_url, "applied", user_id
    )


async def save_application_with_status(
    job_title: str,
    company_name: str,
    platform: str,
    job_url: str,
    status: str,
    user_id: str | None = None,
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
    await app.insert()
    return app
