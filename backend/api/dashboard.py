import csv
import io
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from backend.auth import get_current_user
from backend.models import Application, User
from backend.schemas import ApplicationRead, ApplicationStatusUpdate

router = APIRouter(tags=["dashboard"])

async def _sibling_platforms(user: User, app: Application) -> list[str]:
    if not app.company_name or app.company_name.strip().lower() in ("", "unknown"):
        return []
    
    query = {
        "user_id": str(user.id),
        "_id": {"$ne": app.id},
        "job_title": {"$regex": f"^{app.job_title.strip()}$", "$options": "i"},
        "company_name": {"$regex": f"^{app.company_name.strip()}$", "$options": "i"}
    }
    rows = await Application.find(query).to_list()
    return sorted(list(set(row.platform for row in rows)))

def _app_read(app: Application, siblings: list[str]) -> dict:
    base = ApplicationRead.model_validate(app).model_dump()
    base["other_platforms"] = siblings
    return base

@router.get("/applications", response_model=dict)
async def list_applications(
    platform: str | None = None,
    status: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    follow_up_due: bool = False,
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
):
    query: dict = {"user_id": str(user.id)}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    if search:
        pattern = f".*{search}.*"
        query["$or"] = [
            {"job_title": {"$regex": pattern, "$options": "i"}},
            {"company_name": {"$regex": pattern, "$options": "i"}},
        ]
    
    date_query = {}
    if date_from:
        date_query["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        date_query["$lte"] = datetime.fromisoformat(date_to)
    if date_query:
        query["applied_at"] = date_query
        
    if follow_up_due:
        today = date.today().isoformat()
        query["follow_up_date"] = {"$ne": "", "$lte": today}

    total = await Application.find(query).count()
    offset = (page - 1) * page_size
    rows = await Application.find(query).sort("-applied_at").skip(offset).limit(page_size).to_list()

    items = []
    for r in rows:
        sibs = await _sibling_platforms(user, r)
        items.append(_app_read(r, sibs))

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.patch("/applications/{app_id}", response_model=ApplicationRead)
async def update_application_status(
    app_id: str,
    body: ApplicationStatusUpdate,
    user: User = Depends(get_current_user),
):
    if body.status is None and body.notes is None and body.follow_up_date is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    from beanie import PydanticObjectId
    try:
        req_id = PydanticObjectId(app_id)
    except:
        raise HTTPException(status_code=404, detail="Application not found")

    app = await Application.find_one({"_id": req_id, "user_id": str(user.id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    valid = {"applied", "viewed", "interview", "rejected", "manual_apply_needed"}
    if body.status is not None:
        if body.status not in valid:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
        app.status = body.status
    if body.notes is not None:
        app.notes = body.notes
    if body.follow_up_date is not None:
        app.follow_up_date = body.follow_up_date

    await app.save()
    sibs = await _sibling_platforms(user, app)
    out = _app_read(app, sibs)
    return ApplicationRead(**out)


@router.get("/applications/stats")
async def application_stats(
    user: User = Depends(get_current_user),
):
    total = await Application.find({"user_id": str(user.id)}).count()

    by_status = {}
    for s in ["applied", "viewed", "interview", "rejected", "manual_apply_needed"]:
        by_status[s] = await Application.find({"user_id": str(user.id), "status": s}).count()

    by_platform = {}
    for p in ["linkedin", "indeed", "naukri", "internshala"]:
        by_platform[p] = await Application.find({"user_id": str(user.id), "platform": p}).count()

    follow_ups_due = await Application.find({
        "user_id": str(user.id),
        "follow_up_date": {"$ne": "", "$lte": date.today().isoformat()}
    }).count()

    return {
        "total": total,
        "by_status": by_status,
        "by_platform": by_platform,
        "follow_ups_due": follow_ups_due,
    }


@router.get("/applications/analytics")
async def application_analytics(
    user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc)
    daily: list[dict] = []
    
    thirty_days_ago = today - timedelta(days=30)
    apps_last_30 = await Application.find({
        "user_id": str(user.id),
        "applied_at": {"$gte": thirty_days_ago}
    }).to_list()
    
    buckets = {}
    for a in apps_last_30:
        ds = a.applied_at.date().isoformat()
        buckets[ds] = buckets.get(ds, 0) + 1

    tdt = date.today()
    for i in range(29, -1, -1):
        d = tdt - timedelta(days=i)
        ds = d.isoformat()
        daily.append({"date": ds, "count": buckets.get(ds, 0)})

    by_platform = {}
    for p in ["linkedin", "indeed", "naukri", "internshala"]:
        by_platform[p] = await Application.find({"user_id": str(user.id), "platform": p}).count()

    applied = await Application.find({"user_id": str(user.id), "status": "applied"}).count()
    rejected = await Application.find({"user_id": str(user.id), "status": "rejected"}).count()
    denom = applied + rejected
    success_rate = round(100.0 * applied / denom, 1) if denom else None

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks = now - timedelta(days=14)

    this_week = await Application.find({
        "user_id": str(user.id),
        "applied_at": {"$gte": week_ago}
    }).count()
    
    prev_week = await Application.find({
        "user_id": str(user.id),
        "applied_at": {"$gte": two_weeks, "$lt": week_ago}
    }).count()

    return {
        "daily_applications": daily,
        "by_platform": by_platform,
        "success_rate_percent": success_rate,
        "this_week_count": this_week,
        "prev_week_count": prev_week,
    }


@router.get("/applications/export")
async def export_applications(
    platform: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
):
    query = {"user_id": str(user.id)}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status

    rows = await Application.find(query).sort("-applied_at").to_list()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Job Title", "Company", "Platform", "Status", "Applied At", "Job URL"])
    for r in rows:
        writer.writerow([
            r.job_title,
            r.company_name,
            r.platform,
            r.status,
            r.applied_at.strftime("%Y-%m-%d %H:%M") if r.applied_at else "",
            r.job_url,
        ])

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hireraft_applications.csv"},
    )
