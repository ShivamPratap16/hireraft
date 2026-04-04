from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from backend.auth import get_current_user
from backend.models import User, Application, BotRun, RunLog, PlatformSetting, GlobalSetting, Profile, Notification
from backend.config import decrypt
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
