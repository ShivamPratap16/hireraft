"""Match dispatcher — slice 1.

The auto-apply vs notify decision is extracted into `_decide` so it can be
unit-tested in isolation. The rest of the module is I/O plumbing.
"""

from __future__ import annotations

Decision = str  # "auto_apply" | "notify"


def _decide(
    score: float,
    auto_threshold: float,
    discovery_cap_remaining: int,
    per_platform_room: bool,
) -> Decision:
    """Decide auto_apply vs notify for a match.

    Caller must have already filtered score >= notify_threshold. This function
    only decides between auto_apply (when all gates pass) and notify (anything else).
    """
    can_auto = (
        score >= auto_threshold
        and discovery_cap_remaining > 0
        and per_platform_room
    )
    return "auto_apply" if can_auto else "notify"


# ─── Orchestration ────────────────────────────────────────────────────────

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from beanie import PydanticObjectId

from backend.models import (
    GlobalSetting,
    Job,
    JobMatch,
    PlatformSetting,
    User,
)
from backend.services import application_service, log_service
from backend.services.notification_service import create_notification


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _log_unhandled_task_exception(task: asyncio.Task) -> None:
    exc = task.exception()
    if exc is None:
        return
    asyncio.ensure_future(
        log_service.log(
            "apply:unhandled",
            "system",
            "error",
            f"unhandled task exception: {exc!r}",
            None,
        )
    )


async def _user_email(user_id: str) -> str:
    try:
        u = await User.get(PydanticObjectId(user_id))
        return u.email if u else ""
    except Exception:
        return ""


async def _count_discovery_applies_today(user_id: str) -> int:
    gh = await application_service.daily_count("greenhouse", user_id)
    lv = await application_service.daily_count("lever", user_id)
    return gh + lv


async def _get_platform_settings(user_id: str, ats: str) -> PlatformSetting | None:
    return await PlatformSetting.find_one(
        PlatformSetting.user_id == user_id,
        PlatformSetting.platform == ats,
    )


async def _per_platform_room(user_id: str, ats: str) -> bool:
    ps = await _get_platform_settings(user_id, ats)
    if ps is None:
        return False
    used = await application_service.daily_count(ats, user_id)
    return used < ps.daily_limit


async def dispatch(candidates: list[tuple]) -> None:
    """For each (user, job, score, matched_terms), decide action, write JobMatch,
    fire bot or notify."""
    if not candidates:
        return

    by_user: dict[str, list[tuple]] = defaultdict(list)
    for user, job, score, matched in candidates:
        by_user[str(user.id)].append((user, job, score, matched))

    for user_id, items in by_user.items():
        items.sort(key=lambda t: t[2], reverse=True)
        await _dispatch_for_user(user_id, items)


async def _dispatch_for_user(user_id: str, items: list[tuple]) -> None:
    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
    if g is None:
        return

    discovery_today = await _count_discovery_applies_today(user_id)
    cap_remaining = max(0, g.discovery_daily_cap - discovery_today)

    for user, job, score, matched in items:
        if await JobMatch.find_one(
            JobMatch.user_id == user_id,
            JobMatch.job_id == str(job.id),
        ):
            continue

        platform_room = await _per_platform_room(user_id, job.ats)
        decision = _decide(
            score=score,
            auto_threshold=g.auto_apply_threshold,
            discovery_cap_remaining=cap_remaining,
            per_platform_room=platform_room,
        )

        match = await JobMatch(
            user_id=user_id,
            job_id=str(job.id),
            score=score,
            matched_terms=matched,
            decision=decision,
            state="pending",
        ).insert()

        if decision == "auto_apply":
            cap_remaining -= 1   # consumed at dispatch, not at apply success
            task = asyncio.create_task(_run_apply(user_id, job, match))
            task.add_done_callback(_log_unhandled_task_exception)
        else:
            await create_notification(
                user_id,
                "info",
                f"New match: {job.title} @ {job.company_name}",
                f"Score {score:.2f} — {', '.join(matched[:3])}",
            )


async def _run_apply(user_id: str, job: Job, match: JobMatch) -> None:
    # Import here to avoid a circular import at module load.
    from backend.services.bot_runner import run_one_job

    run_id = f"apply:{uuid.uuid4().hex[:8]}"
    try:
        ok = await run_one_job(job.ats, run_id, user_id, job)
        match.state = "applied" if ok else "failed"
        if ok:
            match.applied_at = _utcnow()
    except Exception as e:
        match.state = "failed"
        await log_service.log(run_id, job.ats, "error", f"match {match.id} crashed: {e}", user_id)
    await match.save()
