"""User-facing discovery endpoints."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException

from backend.auth import get_current_user
from backend.models import GlobalSetting, Job, JobMatch, User
from backend.schemas import DiscoveryStats, MatchFeedItem
from backend.services import log_service


router = APIRouter(prefix="/discovery", tags=["discovery"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/feed", response_model=list[MatchFeedItem])
async def get_feed(
    state: str | None = None,
    limit: int = 50,
    page: int = 1,
    user: User = Depends(get_current_user),
):
    skip = max(0, (page - 1) * limit)
    query: dict = {"user_id": str(user.id)}
    if state:
        query["state"] = state

    matches = (
        await JobMatch.find(query)
        .sort("-created_at")
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    if not matches:
        return []

    job_ids = list({m.job_id for m in matches})
    jobs = await Job.find(In(Job.id, [PydanticObjectId(j) for j in job_ids])).to_list()
    job_map = {str(j.id): j for j in jobs}

    items: list[MatchFeedItem] = []
    for m in matches:
        j = job_map.get(m.job_id)
        if j is None:
            continue
        items.append(
            MatchFeedItem(
                id=str(m.id),
                job_title=j.title,
                company_name=j.company_name,
                location=j.location,
                job_url=j.job_url,
                ats=j.ats,
                score=m.score,
                matched_terms=m.matched_terms,
                decision=m.decision,
                state=m.state,
                created_at=m.created_at,
                applied_at=m.applied_at,
            )
        )
    return items


@router.get("/stats", response_model=DiscoveryStats)
async def get_stats(user: User = Depends(get_current_user)):
    uid = str(user.id)
    total = await JobMatch.find(JobMatch.user_id == uid).count()
    applied = await JobMatch.find(JobMatch.user_id == uid, JobMatch.state == "applied").count()
    pending_notify = await JobMatch.find(
        JobMatch.user_id == uid,
        JobMatch.state == "pending",
        JobMatch.decision == "notify",
    ).count()
    failed = await JobMatch.find(JobMatch.user_id == uid, JobMatch.state == "failed").count()
    dismissed = await JobMatch.find(JobMatch.user_id == uid, JobMatch.state == "dismissed").count()
    return DiscoveryStats(
        total_matches=total,
        applied=applied,
        pending_notify=pending_notify,
        failed=failed,
        dismissed=dismissed,
    )


@router.post("/matches/{mid}/apply")
async def trigger_apply(mid: str, user: User = Depends(get_current_user)):
    """Manual apply trigger for notify-decision matches and failed retries."""
    m = await JobMatch.get(PydanticObjectId(mid))
    if m is None or m.user_id != str(user.id):
        raise HTTPException(404, "not found")
    if m.state == "applied":
        raise HTTPException(409, "already applied")
    if m.state == "dismissed":
        raise HTTPException(409, "match was dismissed")

    job = await Job.get(PydanticObjectId(m.job_id))
    if job is None or job.status != "active":
        raise HTTPException(410, "job is no longer active")

    from backend.services.match_dispatcher import _run_apply
    asyncio.create_task(_run_apply(str(user.id), job, m))
    return {"ok": True, "message": "apply scheduled"}


@router.post("/matches/{mid}/dismiss")
async def dismiss_match(mid: str, user: User = Depends(get_current_user)):
    m = await JobMatch.get(PydanticObjectId(mid))
    if m is None or m.user_id != str(user.id):
        raise HTTPException(404, "not found")
    if m.state == "applied":
        raise HTTPException(409, "cannot dismiss an applied match")
    m.state = "dismissed"
    await m.save()
    return {"ok": True}


@router.post("/rematch")
async def rematch(user: User = Depends(get_current_user)):
    """Backfill: rescore every active Job for this user. 5-min cooldown."""
    uid = str(user.id)
    g = await GlobalSetting.find_one(GlobalSetting.user_id == uid)
    if g is None:
        raise HTTPException(400, "global settings missing")
    if g.last_rematch_at and (_utcnow() - g.last_rematch_at).total_seconds() < 300:
        raise HTTPException(429, "rematch cooldown — try in a few minutes")

    g.last_rematch_at = _utcnow()
    await g.save()

    active_jobs = await Job.find(Job.status == "active").to_list()
    job_ids = [str(j.id) for j in active_jobs]

    run_id = f"rematch:{uuid.uuid4().hex[:8]}"
    await log_service.log(
        run_id, "system", "info",
        f"manual rematch by user {uid} over {len(job_ids)} jobs",
        uid,
    )

    from backend.services import matching_service, match_dispatcher
    candidates = await matching_service.score_jobs(job_ids)
    my_candidates = [c for c in candidates if str(c[0].id) == uid]
    await match_dispatcher.dispatch(my_candidates)

    return {"ok": True, "scored_jobs": len(job_ids), "matches": len(my_candidates)}
