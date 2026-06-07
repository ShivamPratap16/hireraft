"""Matching service — slice 1 (keyword overlap)."""

from __future__ import annotations

import re
from typing import Protocol


class Matcher(Protocol):
    async def score(self, user, settings, job) -> tuple[float, list[str]]:
        """Returns (score in [0, 1], explanation_terms)."""
        ...


_SPLIT_RE = re.compile(r"[,\s]+")


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [t.lower() for t in _SPLIT_RE.split(text.strip()) if t]


class KeywordMatcher:
    """Weighted overlap of user role/keywords/location against job text."""

    WEIGHTS = {"role": 0.4, "keywords": 0.4, "location": 0.2}

    async def score(self, user, settings, job) -> tuple[float, list[str]]:
        haystack = f"{job.title} {job.description} {job.location}".lower()
        matched: list[str] = []
        score = 0.0

        role_terms = _tokenize(settings.role)
        if role_terms:
            per_term = self.WEIGHTS["role"] / len(role_terms)
            for term in role_terms:
                if term in haystack:
                    score += per_term
                    matched.append(term)

        kw_terms = _tokenize(settings.keywords)
        if kw_terms:
            per_term = self.WEIGHTS["keywords"] / len(kw_terms)
            for term in kw_terms:
                if term in haystack:
                    score += per_term
                    matched.append(term)

        if settings.location and settings.location.lower() in haystack:
            score += self.WEIGHTS["location"]
            matched.append(settings.location)

        return min(score, 1.0), matched


# ─── Orchestrator ─────────────────────────────────────────────────────────

from collections import defaultdict
from beanie import PydanticObjectId
from beanie.operators import In

from backend.models import (
    GlobalSetting,
    Job,
    PlatformSetting,
    User,
)


_matcher: Matcher = KeywordMatcher()


def get_matcher() -> Matcher:
    """Swap point — replace with EmbeddingMatcher etc. in a later slice."""
    return _matcher


async def _load_active_discovery_users() -> list[tuple]:
    """Returns [(User, list[PlatformSetting], GlobalSetting), ...] for users
    with discovery_enabled and at least one enabled greenhouse/lever platform."""
    users = await User.find(User.is_blocked == False).to_list()  # noqa: E712
    if not users:
        return []
    ids = [str(u.id) for u in users]

    settings = await PlatformSetting.find(
        In(PlatformSetting.user_id, ids),
        In(
            PlatformSetting.platform,
            ["greenhouse", "lever", "ashby", "workable", "smartrecruiters"],
        ),
        PlatformSetting.enabled == True,  # noqa: E712
    ).to_list()
    globals_ = await GlobalSetting.find(
        In(GlobalSetting.user_id, ids),
        GlobalSetting.discovery_enabled == True,  # noqa: E712
    ).to_list()

    settings_by_user: dict[str, list[PlatformSetting]] = defaultdict(list)
    for s in settings:
        settings_by_user[s.user_id].append(s)
    globals_by_user = {g.user_id: g for g in globals_}

    return [
        (u, settings_by_user[str(u.id)], globals_by_user[str(u.id)])
        for u in users
        if str(u.id) in globals_by_user and settings_by_user[str(u.id)]
    ]


async def score_jobs(job_ids: list[str]) -> list[tuple]:
    """Score the given jobs against every discovery-enabled user.
    Returns [(User, Job, score, matched_terms), ...] for pairs with score >= notify_threshold."""
    if not job_ids:
        return []

    obj_ids = [PydanticObjectId(j) for j in job_ids]
    jobs = await Job.find(
        In(Job.id, obj_ids),
        Job.status == "active",
    ).to_list()
    if not jobs:
        return []

    users_with_settings = await _load_active_discovery_users()
    matcher = get_matcher()
    candidates: list[tuple] = []

    for user, settings_list, g in users_with_settings:
        settings_by_ats = {s.platform: s for s in settings_list}
        for job in jobs:
            settings = settings_by_ats.get(job.ats)
            if settings is None:
                continue
            score, matched = await matcher.score(user, settings, job)
            if score >= g.notify_threshold:
                candidates.append((user, job, score, matched))

    return candidates
