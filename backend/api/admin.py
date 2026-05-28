import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Body
from backend.auth import get_current_user
from backend.models import User, Application, BotRun, RunLog, PlatformSetting, GlobalSetting, Profile, Notification, Company, Job, JobMatch
from backend.config import decrypt
from backend.schemas import (
    CompanyRead, CompanyCreate, CompanyUpdate, CompanySeedItem,
    DiscoveryObservability, JobRead, JobsPage,
)
from pydantic import BaseModel
from beanie import PydanticObjectId
from typing import Optional

router = APIRouter(tags=["admin"])


# ─── Guard ────────────────────────────────────────────────────────────────────
async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if getattr(user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ─── Overview Stats ───────────────────────────────────────────────────────────
class AdminStatsResponse(BaseModel):
    total_users: int
    total_applications: int
    total_runs: int
    active_users_7d: int
    total_errors: int
    apps_today: int
    apps_this_week: int


@router.get("/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(admin: User = Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = await User.count()
    total_applications = await Application.count()
    total_runs = await BotRun.count()

    # Active users: users who triggered a bot run in the last 7 days
    recent_runs = await BotRun.find({"started_at": {"$gte": week_ago}}).to_list()
    active_user_ids = set(r.user_id for r in recent_runs)
    active_users_7d = len(active_user_ids)

    total_errors = await RunLog.find({"level": "error"}).count()
    apps_today = await Application.find({"applied_at": {"$gte": today_start}}).count()
    apps_this_week = await Application.find({"applied_at": {"$gte": week_ago}}).count()

    return AdminStatsResponse(
        total_users=total_users,
        total_applications=total_applications,
        total_runs=total_runs,
        active_users_7d=active_users_7d,
        total_errors=total_errors,
        apps_today=apps_today,
        apps_this_week=apps_this_week,
    )


# ─── Activity Feed (Recent events across all users) ──────────────────────────
@router.get("/admin/activity")
async def get_global_activity(limit: int = 50, admin: User = Depends(get_current_admin)):
    logs = await RunLog.find().sort("-timestamp").limit(min(limit, 200)).to_list()
    items = []
    for l in logs:
        items.append({
            "id": str(l.id),
            "user_id": l.user_id,
            "run_id": l.run_id,
            "platform": l.platform,
            "level": l.level,
            "message": l.message,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        })
    return {"items": items}


# ─── Users List ───────────────────────────────────────────────────────────────
@router.get("/admin/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    admin: User = Depends(get_current_admin),
):
    query = {}
    if search.strip():
        pattern = f".*{search.strip()}.*"
        query["$or"] = [
            {"email": {"$regex": pattern, "$options": "i"}},
            {"name": {"$regex": pattern, "$options": "i"}},
        ]

    users = await User.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    total = await User.find(query).count()

    out = []
    for u in users:
        # Per-user stats
        app_count = await Application.find({"user_id": str(u.id)}).count()
        run_count = await BotRun.find({"user_id": str(u.id)}).count()

        out.append({
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "role": getattr(u, "role", "user"),
            "is_blocked": getattr(u, "is_blocked", False),
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "app_count": app_count,
            "run_count": run_count,
        })

    return {"items": out, "total": total, "skip": skip, "limit": limit}


# ─── Single User Deep View ───────────────────────────────────────────────────
@router.get("/admin/users/{user_id}")
async def get_user_detail(user_id: str, admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Profile
    profile = await Profile.find_one({"user_id": str(user.id)})
    profile_data = profile.model_dump() if profile else {}
    if profile_data.get("_id"):
        profile_data["id"] = str(profile_data.pop("_id"))

    # Platform settings (with decrypted passwords for admin view)
    platform_settings = await PlatformSetting.find({"user_id": str(user.id)}).to_list()
    platforms = []
    for ps in platform_settings:
        d = ps.model_dump()
        d["id"] = str(d.pop("_id", ps.id))
        if d.get("password"):
            d["password_decrypted"] = decrypt(d["password"])
        else:
            d["password_decrypted"] = ""
        platforms.append(d)

    # Global settings
    gs = await GlobalSetting.find_one({"user_id": str(user.id)})
    global_settings = {}
    if gs:
        global_settings = gs.model_dump()
        if global_settings.get("_id"):
            global_settings["id"] = str(global_settings.pop("_id"))

    # Applications (last 50)
    apps = await Application.find({"user_id": str(user.id)}).sort("-applied_at").limit(50).to_list()
    applications = []
    for a in apps:
        applications.append({
            "id": str(a.id),
            "job_title": a.job_title,
            "company_name": a.company_name,
            "platform": a.platform,
            "job_url": a.job_url,
            "status": a.status,
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
        })

    # Bot runs (last 20)
    runs = await BotRun.find({"user_id": str(user.id)}).sort("-started_at").limit(20).to_list()
    bot_runs = []
    for r in runs:
        bot_runs.append({
            "id": str(r.id),
            "run_id": r.run_id,
            "platform": r.platform,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "jobs_found": r.jobs_found,
            "jobs_applied": r.jobs_applied,
            "error_count": r.error_count,
        })

    # Recent Logs (last 100)
    logs = await RunLog.find({"user_id": str(user.id)}).sort("-timestamp").limit(100).to_list()
    log_entries = []
    for l in logs:
        log_entries.append({
            "id": str(l.id),
            "run_id": l.run_id,
            "platform": l.platform,
            "level": l.level,
            "message": l.message,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        })

    app_count = await Application.find({"user_id": str(user.id)}).count()
    run_count = await BotRun.find({"user_id": str(user.id)}).count()

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": getattr(user, "role", "user"),
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "hashed_password": user.hashed_password,
        },
        "stats": {"app_count": app_count, "run_count": run_count},
        "profile": profile_data,
        "platform_settings": platforms,
        "global_settings": global_settings,
        "applications": applications,
        "bot_runs": bot_runs,
        "logs": log_entries,
    }


# ─── User Role Change ────────────────────────────────────────────────────────
class RoleUpdate(BaseModel):
    role: str

@router.patch("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, body: RoleUpdate, admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

    user.role = body.role
    await user.save()
    return {"ok": True, "role": user.role}


# ─── Reset User Password ─────────────────────────────────────────────────────
class PasswordReset(BaseModel):
    new_password: str

@router.patch("/admin/users/{user_id}/password")
async def reset_user_password(user_id: str, body: PasswordReset, admin: User = Depends(get_current_admin)):
    from backend.auth import hash_password
    try:
        uid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    user.hashed_password = hash_password(body.new_password)
    await user.save()
    return {"ok": True, "message": f"Password reset for {user.email}"}


# ─── Block / Unblock User ────────────────────────────────────────────────────
@router.patch("/admin/users/{user_id}/block")
async def toggle_block_user(user_id: str, admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    user.is_blocked = not getattr(user, "is_blocked", False)
    await user.save()
    return {"ok": True, "is_blocked": user.is_blocked}


# ─── Delete User ──────────────────────────────────────────────────────────────
@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    uid_str = str(user.id)
    # Cascade delete all user data
    await Application.find({"user_id": uid_str}).delete()
    await BotRun.find({"user_id": uid_str}).delete()
    await RunLog.find({"user_id": uid_str}).delete()
    await PlatformSetting.find({"user_id": uid_str}).delete()
    await GlobalSetting.find({"user_id": uid_str}).delete()
    await Profile.find({"user_id": uid_str}).delete()
    await Notification.find({"user_id": uid_str}).delete()
    await user.delete()

    return {"ok": True}


# ─── Platform-Level Analytics ────────────────────────────────────────────────
@router.get("/admin/analytics")
async def get_admin_analytics(admin: User = Depends(get_current_admin)):
    now = datetime.now(timezone.utc)

    # Applications per day (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    apps_30 = await Application.find({"applied_at": {"$gte": thirty_days_ago}}).to_list()
    daily = {}
    for a in apps_30:
        ds = a.applied_at.strftime("%Y-%m-%d")
        daily[ds] = daily.get(ds, 0) + 1

    daily_series = []
    from datetime import date
    today = date.today()
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        daily_series.append({"date": ds, "count": daily.get(ds, 0)})

    # By platform
    by_platform = {}
    for p in ["linkedin", "indeed", "naukri", "internshala"]:
        by_platform[p] = await Application.find({"platform": p}).count()

    # By status
    by_status = {}
    for s in ["applied", "viewed", "interview", "rejected", "manual_apply_needed"]:
        by_status[s] = await Application.find({"status": s}).count()

    # Errors per day (last 7 days)
    week_ago = now - timedelta(days=7)
    error_logs = await RunLog.find({"level": "error", "timestamp": {"$gte": week_ago}}).to_list()
    error_daily = {}
    for e in error_logs:
        ds = e.timestamp.strftime("%Y-%m-%d")
        error_daily[ds] = error_daily.get(ds, 0) + 1

    error_series = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        error_series.append({"date": ds, "count": error_daily.get(ds, 0)})

    # Registration trend (last 30 days)
    users_30 = await User.find({"created_at": {"$gte": thirty_days_ago}}).to_list()
    reg_daily = {}
    for u in users_30:
        ds = u.created_at.strftime("%Y-%m-%d")
        reg_daily[ds] = reg_daily.get(ds, 0) + 1

    reg_series = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        reg_series.append({"date": ds, "count": reg_daily.get(ds, 0)})

    return {
        "daily_applications": daily_series,
        "by_platform": by_platform,
        "by_status": by_status,
        "error_trend": error_series,
        "registration_trend": reg_series,
    }


# ─── Slice-1 discovery: Companies CRUD + seed + sync trigger ──────────────

def _company_to_read(c: Company) -> CompanyRead:
    return CompanyRead(
        id=str(c.id),
        name=c.name,
        ats=c.ats,
        slug=c.slug,
        active=c.active,
        last_synced_at=c.last_synced_at,
        last_sync_error=c.last_sync_error,
        created_at=c.created_at,
    )


@router.get("/admin/companies", response_model=list[CompanyRead])
async def list_companies(
    ats: Optional[str] = None,
    active: Optional[bool] = None,
    admin: User = Depends(get_current_admin),
):
    query: dict = {}
    if ats is not None:
        query["ats"] = ats
    if active is not None:
        query["active"] = active
    companies = await Company.find(query).to_list()
    return [_company_to_read(c) for c in companies]


@router.post("/admin/companies", response_model=CompanyRead)
async def create_company(body: CompanyCreate, admin: User = Depends(get_current_admin)):
    if body.ats not in ("greenhouse", "lever"):
        raise HTTPException(400, "ats must be 'greenhouse' or 'lever'")
    existing = await Company.find_one(Company.ats == body.ats, Company.slug == body.slug)
    if existing:
        raise HTTPException(409, "company with this ats+slug already exists")
    co = await Company(name=body.name, ats=body.ats, slug=body.slug).insert()
    return _company_to_read(co)


@router.patch("/admin/companies/{cid}", response_model=CompanyRead)
async def update_company(
    cid: str,
    body: CompanyUpdate,
    admin: User = Depends(get_current_admin),
):
    co = await Company.get(PydanticObjectId(cid))
    if co is None:
        raise HTTPException(404, "not found")
    if body.active is not None:
        co.active = body.active
    if body.name is not None:
        co.name = body.name
    if body.slug is not None:
        co.slug = body.slug
    await co.save()
    return _company_to_read(co)


@router.delete("/admin/companies/{cid}")
async def delete_company(cid: str, admin: User = Depends(get_current_admin)):
    co = await Company.get(PydanticObjectId(cid))
    if co is None:
        raise HTTPException(404, "not found")
    await co.delete()
    return {"ok": True}


@router.post("/admin/companies/seed")
async def seed_companies(admin: User = Depends(get_current_admin)):
    """Idempotent — upserts on (ats, slug) from backend/data/companies.json."""
    seed_path = Path(__file__).resolve().parent.parent / "data" / "companies.json"
    if not seed_path.exists():
        raise HTTPException(404, f"seed file not found at {seed_path}")
    items = [CompanySeedItem(**x) for x in json.loads(seed_path.read_text())]
    created = 0
    updated = 0
    for item in items:
        existing = await Company.find_one(Company.ats == item.ats, Company.slug == item.slug)
        if existing:
            existing.name = item.name
            await existing.save()
            updated += 1
        else:
            await Company(name=item.name, ats=item.ats, slug=item.slug).insert()
            created += 1
    return {"created": created, "updated": updated, "total": len(items)}


@router.post("/admin/discovery/sync")
async def trigger_sync(admin: User = Depends(get_current_admin)):
    """Manual trigger for the full discovery cycle. Dev/debug aid."""
    from backend.scheduler import discovery_cycle
    asyncio.create_task(discovery_cycle())
    return {"ok": True, "message": "discovery cycle scheduled"}


def _job_to_read(j: Job) -> JobRead:
    return JobRead(
        id=str(j.id),
        external_id=j.external_id,
        ats=j.ats,
        company_slug=j.company_slug,
        company_name=j.company_name,
        title=j.title,
        location=j.location,
        job_url=j.job_url,
        status=j.status,
        first_seen_at=j.first_seen_at,
        last_seen_at=j.last_seen_at,
        closed_at=j.closed_at,
        description_preview=(j.description or "")[:200],
    )


# Bucket jobs by location text. A job is "india" if its location matches one
# of these tokens (case-insensitive). Everything else with a non-empty location
# counts as "foreign". An empty location is neither — region filter excludes it.
INDIA_LOCATION_PATTERN = (
    r"\b("
    r"india|"
    r"bangalore|bengaluru|"
    r"mumbai|bombay|"
    r"delhi|new delhi|"
    r"gurgaon|gurugram|"
    r"noida|"
    r"hyderabad|"
    r"pune|"
    r"chennai|madras|"
    r"kolkata|calcutta|"
    r"ahmedabad|"
    r"jaipur|"
    r"kochi|cochin|kerala|"
    r"chandigarh|"
    r"indore|"
    r"coimbatore|"
    r"trivandrum|thiruvananthapuram"
    r")\b"
)


@router.get("/admin/jobs", response_model=JobsPage)
async def list_jobs(
    ats: Optional[str] = None,
    status: Optional[str] = None,
    company_slug: Optional[str] = None,
    q: Optional[str] = None,
    region: Optional[str] = None,        # "india" | "foreign" | None (= all)
    page: int = 1,
    page_size: int = 50,
    admin: User = Depends(get_current_admin),
):
    """Paginated, read-only view of the global Job index.

    Filters: ats, status, company_slug, q (regex on title), region (india|foreign).
    Sorted by last_seen_at desc.
    """
    page = max(1, page)
    page_size = max(1, min(200, page_size))
    skip = (page - 1) * page_size

    mongo_query: dict = {}
    if ats:
        mongo_query["ats"] = ats
    if status:
        mongo_query["status"] = status
    if company_slug:
        mongo_query["company_slug"] = company_slug
    if q:
        mongo_query["title"] = {"$regex": q, "$options": "i"}
    if region == "india":
        mongo_query["location"] = {"$regex": INDIA_LOCATION_PATTERN, "$options": "i"}
    elif region == "foreign":
        # non-empty location that doesn't match the India pattern
        mongo_query["location"] = {
            "$nin": ["", None],
            "$not": {"$regex": INDIA_LOCATION_PATTERN, "$options": "i"},
        }

    total = await Job.find(mongo_query).count()
    items = (
        await Job.find(mongo_query)
        .sort("-last_seen_at")
        .skip(skip)
        .limit(page_size)
        .to_list()
    )
    return JobsPage(
        total=total,
        page=page,
        page_size=page_size,
        items=[_job_to_read(j) for j in items],
    )


@router.get("/admin/discovery/observability", response_model=DiscoveryObservability)
async def discovery_observability(admin: User = Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now - timedelta(days=7)

    jobs_new_today = await Job.find(Job.first_seen_at >= start_of_today).count()
    matches_dispatched_today = await JobMatch.find(JobMatch.created_at >= start_of_today).count()

    auto_attempts = await JobMatch.find(
        JobMatch.decision == "auto_apply",
        JobMatch.created_at >= seven_days_ago,
    ).count()
    auto_succeeded = await JobMatch.find(
        JobMatch.decision == "auto_apply",
        JobMatch.state == "applied",
        JobMatch.created_at >= seven_days_ago,
    ).count()

    rate: Optional[float] = None
    if auto_attempts > 0:
        rate = round(auto_succeeded / auto_attempts, 3)

    return DiscoveryObservability(
        jobs_new_today=jobs_new_today,
        matches_dispatched_today=matches_dispatched_today,
        auto_apply_success_rate_7d=rate,
        auto_apply_attempts_7d=auto_attempts,
        auto_apply_succeeded_7d=auto_succeeded,
    )
