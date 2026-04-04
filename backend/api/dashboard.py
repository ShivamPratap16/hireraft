import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Application, User
from backend.schemas import ApplicationRead, ApplicationStatusUpdate

router = APIRouter(tags=["dashboard"])


async def _sibling_platforms(
    db: AsyncSession, user_id: int, app: Application
) -> list[str]:
    if not app.company_name or app.company_name.strip().lower() in ("", "unknown"):
        return []
    result = await db.execute(
        select(Application.platform).where(
            Application.user_id == user_id,
            Application.id != app.id,
            func.lower(Application.job_title) == app.job_title.strip().lower(),
            func.lower(Application.company_name) == app.company_name.strip().lower(),
        )
    )
    return sorted({row[0] for row in result.fetchall()})


def _app_read(app: Application, siblings: list[str]) -> ApplicationRead:
    base = ApplicationRead.model_validate(app)
    return base.model_copy(update={"other_platforms": siblings})


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
    db: AsyncSession = Depends(get_db),
):
    conditions = [Application.user_id == user.id]
    if platform:
        conditions.append(Application.platform == platform)
    if status:
        conditions.append(Application.status == status)
    if search:
        pattern = f"%{search.lower()}%"
        conditions.append(
            or_(
                func.lower(Application.job_title).like(pattern),
                func.lower(Application.company_name).like(pattern),
            )
        )
    if date_from:
        conditions.append(Application.applied_at >= datetime.fromisoformat(date_from))
    if date_to:
        conditions.append(Application.applied_at <= datetime.fromisoformat(date_to))
    if follow_up_due:
        today = date.today().isoformat()
        conditions.append(Application.follow_up_date != "")
        conditions.append(Application.follow_up_date <= today)

    where_clause = and_(*conditions)

    total_q = await db.execute(select(func.count(Application.id)).where(where_clause))
    total = total_q.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Application)
        .where(where_clause)
        .order_by(Application.applied_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.scalars().all()

    items = []
    for r in rows:
        sibs = await _sibling_platforms(db, user.id, r)
        items.append(_app_read(r, sibs))

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.patch("/applications/{app_id}", response_model=ApplicationRead)
async def update_application_status(
    app_id: int,
    body: ApplicationStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.status is None and body.notes is None and body.follow_up_date is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.execute(
        select(Application).where(Application.id == app_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
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

    await db.commit()
    await db.refresh(app)
    sibs = await _sibling_platforms(db, user.id, app)
    return _app_read(app, sibs)


@router.get("/applications/stats")
async def application_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_q = await db.execute(
        select(func.count(Application.id)).where(Application.user_id == user.id)
    )
    total = total_q.scalar() or 0

    by_status = {}
    for s in ["applied", "viewed", "interview", "rejected", "manual_apply_needed"]:
        q = await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == user.id, Application.status == s
            )
        )
        by_status[s] = q.scalar() or 0

    by_platform = {}
    for p in ["linkedin", "indeed", "naukri", "internshala"]:
        q = await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == user.id, Application.platform == p
            )
        )
        by_platform[p] = q.scalar() or 0

    follow_q = await db.execute(
        select(func.count(Application.id)).where(
            Application.user_id == user.id,
            Application.follow_up_date != "",
            Application.follow_up_date <= date.today().isoformat(),
        )
    )
    follow_ups_due = follow_q.scalar() or 0

    return {
        "total": total,
        "by_status": by_status,
        "by_platform": by_platform,
        "follow_ups_due": follow_ups_due,
    }


@router.get("/applications/analytics")
async def application_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    daily: list[dict] = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        q = await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == user.id,
                func.date(Application.applied_at) == ds,
            )
        )
        daily.append({"date": ds, "count": q.scalar() or 0})

    by_platform = {}
    for p in ["linkedin", "indeed", "naukri", "internshala"]:
        q = await db.execute(
            select(func.count(Application.id)).where(
                Application.user_id == user.id, Application.platform == p
            )
        )
        by_platform[p] = q.scalar() or 0

    applied = await db.scalar(
        select(func.count(Application.id)).where(
            Application.user_id == user.id, Application.status == "applied"
        )
    ) or 0
    rejected = await db.scalar(
        select(func.count(Application.id)).where(
            Application.user_id == user.id, Application.status == "rejected"
        )
    ) or 0
    denom = applied + rejected
    success_rate = round(100.0 * applied / denom, 1) if denom else None

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks = now - timedelta(days=14)

    this_week = await db.scalar(
        select(func.count(Application.id)).where(
            Application.user_id == user.id,
            Application.applied_at >= week_ago,
        )
    ) or 0
    prev_week = await db.scalar(
        select(func.count(Application.id)).where(
            Application.user_id == user.id,
            Application.applied_at >= two_weeks,
            Application.applied_at < week_ago,
        )
    ) or 0

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
    db: AsyncSession = Depends(get_db),
):
    conditions = [Application.user_id == user.id]
    if platform:
        conditions.append(Application.platform == platform)
    if status:
        conditions.append(Application.status == status)

    result = await db.execute(
        select(Application)
        .where(and_(*conditions))
        .order_by(Application.applied_at.desc())
    )
    rows = result.scalars().all()

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
