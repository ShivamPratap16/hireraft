"""Single-job ATS apply runner — the Discovery channel's runtime.

Parallel to ``bot_runner`` (which orchestrates the search-and-apply
automation fleet), this module exists because the two runtimes have
genuinely different shapes:

- ``bot_runner.run_platform`` does login → search → loop, driving the
  user's logged-in session with their stored credentials.
- ``run_one_job`` here takes a single ``Job`` row, opens its public ATS
  form, fills it from the user's Profile, and submits. No login. No loop.

Both bot classes (``BaseBot`` vs ``AtsApplyBot``) and both maps
(``BOT_MAP`` vs ``ATS_BOT_MAP``) are deliberately separate for the same
reason.
"""

from backend.bots.ats_base import AtsApplyBot
from backend.bots.greenhouse import GreenhouseBot
from backend.bots.lever import LeverBot
from backend.models import GlobalSetting, Job, Profile
from backend.services import log_service


ATS_BOT_MAP: dict[str, type[AtsApplyBot]] = {
    "greenhouse": GreenhouseBot,
    "lever": LeverBot,
    # Ashby / Workable / SmartRecruiters live in Discovery as notify-only —
    # apply-bots aren't implemented yet, so they're absent from this map and
    # the dispatcher correctly routes their matches to `notify` decisions.
}


async def run_one_job(ats: str, run_id: str, user_id: str, job: Job) -> bool:
    """Open the ATS form for `job`, fill it from the user's Profile, submit.

    Pre-flight checks: bot exists, profile exists, resume uploaded. Each
    missing precondition fails fast with a clear log line — the dispatcher's
    cap is consumed regardless (matches the "all auto-apply attempts burn
    cap" rule documented in the slice-1 spec).
    """
    bot_cls = ATS_BOT_MAP.get(ats)
    if bot_cls is None:
        await log_service.log(run_id, ats, "error", f"no bot for ats={ats}", user_id)
        return False

    profile = await Profile.find_one(Profile.user_id == user_id)
    if profile is None:
        await log_service.log(
            run_id, ats, "error",
            "no profile — complete profile to enable auto-apply",
            user_id,
        )
        return False

    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
    if g is None or not g.resume_path:
        await log_service.log(run_id, ats, "error", "no resume uploaded", user_id)
        return False

    bot = bot_cls(
        run_id=run_id, user_id=user_id, job=job, profile=profile,
        resume_path=g.resume_path,
    )
    return await bot.run()
