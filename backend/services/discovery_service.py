"""ATS discovery service — slice 1 (Greenhouse + Lever)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html import unescape


@dataclass
class NormalizedJob:
    """ATS-agnostic representation of a posting."""
    external_id: str
    title: str
    description: str       # plain text, HTML stripped
    location: str
    job_url: str
    raw: dict = field(default_factory=dict)


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(text: str) -> str:
    if not text:
        return ""
    no_tags = _HTML_TAG_RE.sub(" ", text)
    decoded = unescape(no_tags)
    return _WHITESPACE_RE.sub(" ", decoded).strip()


def _normalize_greenhouse(job: dict) -> NormalizedJob:
    loc = job.get("location") or {}
    return NormalizedJob(
        external_id=str(job["id"]),
        title=job.get("title", "").strip(),
        description=_strip_html(job.get("content", "")),
        location=(loc.get("name") or "").strip() if isinstance(loc, dict) else str(loc),
        job_url=job.get("absolute_url", ""),
        raw=job,
    )


def _normalize_lever(job: dict) -> NormalizedJob:
    cats = job.get("categories") or {}
    desc = job.get("descriptionPlain") or _strip_html(job.get("description", ""))
    return NormalizedJob(
        external_id=str(job["id"]),
        title=job.get("text", "").strip(),
        description=desc.strip(),
        location=(cats.get("location") or "").strip(),
        job_url=job.get("hostedUrl", ""),
        raw=job,
    )


# ─── Sync orchestration ───────────────────────────────────────────────────

import asyncio
import hashlib
from datetime import datetime, timezone

import httpx
from beanie.operators import In

from backend.models import Company, Job


def _md5(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SyncStats:
    companies_synced: int = 0
    companies_failed: int = 0
    jobs_new: int = 0
    jobs_updated: int = 0
    jobs_closed: int = 0
    new_job_ids: list[str] = field(default_factory=list)
    changed_job_ids: list[str] = field(default_factory=list)


async def fetch_greenhouse(slug: str) -> list[NormalizedJob]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        return [_normalize_greenhouse(j) for j in r.json().get("jobs", [])]


async def fetch_lever(slug: str) -> list[NormalizedJob]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        return [_normalize_lever(j) for j in r.json()]


ADAPTERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
}


async def sync_company(co: Company) -> tuple[list[str], list[str]]:
    """Returns (new_job_ids, changed_job_ids). Failures recorded on the Company."""
    fetcher = ADAPTERS.get(co.ats)
    if fetcher is None:
        co.last_sync_error = f"no adapter for ats={co.ats}"
        await co.save()
        return [], []

    try:
        live_jobs = await fetcher(co.slug)
    except Exception as e:
        co.last_sync_error = str(e)[:500]
        await co.save()
        return [], []

    now = _utcnow()
    live_ids = [f"{co.ats}:{co.slug}:{nj.external_id}" for nj in live_jobs]

    existing_map = {
        j.external_id: j
        for j in await Job.find(In(Job.external_id, live_ids)).to_list()
    }

    new_ids: list[str] = []
    changed_ids: list[str] = []

    for nj in live_jobs:
        ext_id = f"{co.ats}:{co.slug}:{nj.external_id}"
        new_hash = _md5(nj.description)
        existing = existing_map.get(ext_id)

        if existing:
            existing.last_seen_at = now
            if existing.status == "closed":
                existing.status = "active"
                existing.closed_at = None
            if existing.description_hash != new_hash:
                existing.description = nj.description
                existing.description_hash = new_hash
                existing.title = nj.title
                existing.location = nj.location
                changed_ids.append(str(existing.id))
            await existing.save()
        else:
            created = await Job(
                external_id=ext_id,
                ats=co.ats,
                company_slug=co.slug,
                company_name=co.name,
                title=nj.title,
                description=nj.description,
                description_hash=new_hash,
                location=nj.location,
                job_url=nj.job_url,
                first_seen_at=now,
                last_seen_at=now,
                raw=nj.raw,
            ).insert()
            new_ids.append(str(created.id))

    co.last_synced_at = now
    co.last_sync_error = ""
    await co.save()
    return new_ids, changed_ids


async def mark_stale_jobs(threshold: datetime) -> int:
    """Any active Job not seen since `threshold` → status=closed. Returns count."""
    stale = await Job.find(
        Job.status == "active", Job.last_seen_at < threshold
    ).to_list()
    for j in stale:
        j.status = "closed"
        j.closed_at = _utcnow()
        await j.save()
    return len(stale)


async def sync_all() -> SyncStats:
    """Poll every active Company in parallel; upsert Jobs; mark stale closed."""
    sync_started_at = _utcnow()
    stats = SyncStats()

    companies = await Company.find(Company.active == True).to_list()  # noqa: E712
    if not companies:
        return stats

    results = await asyncio.gather(
        *(sync_company(c) for c in companies),
        return_exceptions=True,
    )

    for co, result in zip(companies, results):
        if isinstance(result, Exception):
            stats.companies_failed += 1
            continue
        new_ids, changed_ids = result
        stats.companies_synced += 1
        stats.jobs_new += len(new_ids)
        stats.jobs_updated += len(changed_ids)
        stats.new_job_ids.extend(new_ids)
        stats.changed_job_ids.extend(changed_ids)

    stats.jobs_closed = await mark_stale_jobs(sync_started_at)
    return stats
