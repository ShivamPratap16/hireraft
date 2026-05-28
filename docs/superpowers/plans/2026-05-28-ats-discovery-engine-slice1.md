# ATS Discovery Engine (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the slice-1 discovery engine — hourly Greenhouse + Lever ATS polling, per-user keyword-overlap matching, hybrid auto-apply/notify dispatcher, two new ATS apply bots, and the surrounding admin + user UI.

**Architecture:** Hourly cron drives `discovery_cycle()` → `discovery_service.sync_all()` polls ATS APIs (parallel, `return_exceptions=True`) and upserts into a global `Job` collection → `matching_service.score_jobs()` runs `KeywordMatcher` against each discovery-enabled user → `match_dispatcher.dispatch()` decides auto-apply vs notify based on per-user thresholds and a daily cap → `AtsApplyBot` subclasses (Greenhouse, Lever) fill the public ATS form via Playwright. Three new services, two new bots, three new collections, plus admin + user pages.

**Tech stack:** Python 3.14 venv at `./venv`, FastAPI, Beanie/Motor (MongoDB), Playwright, APScheduler, httpx, pytest + pytest-asyncio (new), React 19, TypeScript, TanStack Query.

**Reference spec:** `docs/superpowers/specs/2026-05-28-ats-discovery-engine-slice1-design.md`. Where the plan and the spec disagree, the spec wins — flag the discrepancy and stop.

---

## Pre-Task 0: Land the existing scheduler patch

There's a working-tree change to `backend/scheduler.py` from a prior session (SQLAlchemy → Beanie port that was needed to make the backend start). It's unrelated to this plan; commit it alone so the rest of the plan's commits stay clean.

**Files:**
- Commit: `backend/scheduler.py` (already modified in working tree)

- [ ] **Step 1: Confirm only `backend/scheduler.py` is modified**

```bash
cd ~/personal/hireraft && git status --short
```
Expected output:
```
 M backend/scheduler.py
```
If anything else is dirty, stash or commit it separately first.

- [ ] **Step 2: Commit**

```bash
cd ~/personal/hireraft && git add backend/scheduler.py && git commit -m "$(cat <<'EOF'
Port scheduler.py from SQLAlchemy to Beanie

backend/database.py uses Beanie/Motor exclusively now, but
scheduler.py still imported sqlalchemy.select and async_session
from the previous SQLAlchemy version of the app — which crashed
backend startup, not just the 9 AM cron fire.

Replaces the SQLAlchemy query with the equivalent Beanie one.
EOF
)"
```

- [ ] **Step 3: Verify clean tree**

```bash
cd ~/personal/hireraft && git status
```
Expected: `nothing to commit, working tree clean`.

---

## Task 1: Wire up pytest

Add the test runner this slice needs. The repo has no tests today (per CLAUDE.md).

**Files:**
- Modify: `backend/requirements.txt`
- Create: `pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Add pytest dependencies**

Append to `backend/requirements.txt`:
```
pytest
pytest-asyncio
```

- [ ] **Step 2: Install**

```bash
cd ~/personal/hireraft && ./venv/bin/pip install pytest pytest-asyncio
```
Expected: `Successfully installed pytest-... pytest-asyncio-...`

- [ ] **Step 3: Create `pytest.ini` at repo root**

```ini
[pytest]
testpaths = backend/tests
asyncio_mode = auto
pythonpath = .
```

- [ ] **Step 4: Create empty `backend/tests/__init__.py`**

Empty file — makes `backend.tests` an importable package.

- [ ] **Step 5: Create `backend/tests/conftest.py`**

```python
"""Shared pytest fixtures. No DB fixtures in slice 1 — tests are pure-function."""
```

- [ ] **Step 6: Verify pytest runs (collecting zero tests is the right outcome here)**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest -v
```
Expected: `no tests ran in 0.0Xs` (no errors).

- [ ] **Step 7: Commit**

```bash
cd ~/personal/hireraft && git add backend/requirements.txt pytest.ini backend/tests/ && git commit -m "Wire up pytest + pytest-asyncio for slice-1 discovery tests"
```

---

## Task 2: Shared `USER_AGENT` constant

Extract the UA string from `bots/base.py` to a shared module so the new `AtsApplyBot` can reuse it without duplicating.

**Files:**
- Create: `backend/bots/_constants.py`
- Modify: `backend/bots/base.py` (use the shared constant)

- [ ] **Step 1: Create `backend/bots/_constants.py`**

```python
"""Constants shared across BaseBot and AtsApplyBot."""

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
```

- [ ] **Step 2: Use the constant in `backend/bots/base.py`**

Locate the inline UA inside `_execute_run_once` (around the `ctx_kwargs = {"user_agent": ...}` block) and replace with:

```python
from backend.bots._constants import USER_AGENT
# ...
ctx_kwargs = {"user_agent": USER_AGENT}
```

Place the `from` import at the top of the file with the other imports.

- [ ] **Step 3: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.bots.base import BaseBot; from backend.bots._constants import USER_AGENT; print(USER_AGENT[:30])"
```
Expected: `Mozilla/5.0 (Macintosh; Intel`.

- [ ] **Step 4: Commit**

```bash
cd ~/personal/hireraft && git add backend/bots/_constants.py backend/bots/base.py && git commit -m "Extract USER_AGENT to bots/_constants.py for reuse by AtsApplyBot"
```

---

## Task 3: Add the three new Beanie documents

Add `Company`, `Job`, `JobMatch` to `backend/models.py` and register them in `backend/database.py`. Also extend `GlobalSetting` with the four new discovery fields.

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/database.py`

- [ ] **Step 1: Add imports + new models to `backend/models.py`**

At the top of `backend/models.py`, ensure these imports exist (add if missing):
```python
from pymongo import IndexModel
```

Append at the bottom of `backend/models.py`:

```python
class Company(Document):
    name: str
    ats: str                                  # "greenhouse" | "lever"
    slug: Indexed(str)
    active: bool = True
    last_synced_at: datetime | None = None
    last_sync_error: str = ""
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "companies"
        indexes = [
            IndexModel([("ats", 1), ("slug", 1)], unique=True),
        ]


class Job(Document):
    external_id: Indexed(str, unique=True)     # "greenhouse:swiggy:4001234"
    ats: str                                    # "greenhouse" | "lever"
    company_slug: str
    company_name: str
    title: str
    description: str = ""
    description_hash: str = ""
    location: str = ""
    job_url: str
    status: str = "active"                      # "active" | "closed"
    first_seen_at: datetime = Field(default_factory=utcnow)
    last_seen_at: datetime = Field(default_factory=utcnow)
    closed_at: datetime | None = None
    raw: dict = Field(default_factory=dict)

    class Settings:
        name = "jobs"
        indexes = [
            "status",
            "ats",
            [("company_slug", 1), ("status", 1)],
        ]


class JobMatch(Document):
    user_id: Indexed(str)
    job_id: str
    score: float
    matched_terms: list[str] = []
    decision: str                               # "auto_apply" | "notify"
    state: str = "pending"                      # pending | applied | failed | dismissed
    created_at: datetime = Field(default_factory=utcnow)
    applied_at: datetime | None = None

    class Settings:
        name = "job_matches"
        indexes = [
            IndexModel([("user_id", 1), ("job_id", 1)], unique=True),
            "state",
        ]
```

- [ ] **Step 2: Extend `GlobalSetting` with four discovery fields**

In `backend/models.py`, locate the existing `GlobalSetting` class and add these fields (keep existing fields):

```python
class GlobalSetting(Document):
    user_id: Indexed(str)
    resume_path: str = ""
    schedule_time: str = "09:00"
    schedule_enabled: bool = True
    # --- slice-1 discovery additions ---
    discovery_enabled: bool = True
    auto_apply_threshold: float = 0.9
    notify_threshold: float = 0.6
    discovery_daily_cap: int = 20
    last_rematch_at: datetime | None = None

    class Settings:
        name = "global_settings"
```

- [ ] **Step 3: Register new documents in `backend/database.py`**

In `init_db`, extend the `document_models` list:

```python
await init_beanie(database=client.get_default_database(), document_models=[
    backend.models.User,
    backend.models.PlatformSetting,
    backend.models.Application,
    backend.models.RunLog,
    backend.models.GlobalSetting,
    backend.models.BotRun,
    backend.models.Notification,
    backend.models.Profile,
    backend.models.Company,      # new
    backend.models.Job,          # new
    backend.models.JobMatch,     # new
])
```

- [ ] **Step 4: Boot backend to validate Beanie initialization**

```bash
cd ~/personal/hireraft && ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!
sleep 4
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8001/docs
kill $BACKEND_PID
```
Expected: `HTTP 200`. If init_db raises, fix and retry.

- [ ] **Step 5: Commit**

```bash
cd ~/personal/hireraft && git add backend/models.py backend/database.py && git commit -m "Add Company, Job, JobMatch models; extend GlobalSetting for discovery"
```

---

## Task 4: Adapter normalization (TDD)

Greenhouse and Lever API responses get normalized to a single `NormalizedJob` dataclass. Pure functions — testable without Mongo or network.

**Files:**
- Create: `backend/tests/fixtures/greenhouse_sample.json`
- Create: `backend/tests/fixtures/lever_sample.json`
- Create: `backend/tests/test_adapters.py`
- Create: `backend/services/discovery_service.py` (adapters only in this task; sync_all next task)

- [ ] **Step 1: Create Greenhouse fixture `backend/tests/fixtures/greenhouse_sample.json`**

```json
{
  "jobs": [
    {
      "id": 4001234,
      "title": "Backend Engineer",
      "absolute_url": "https://boards.greenhouse.io/swiggy/jobs/4001234",
      "location": {"name": "Bangalore, India"},
      "content": "<p>We&#39;re looking for a <b>backend engineer</b> to work on our delivery platform. Python, FastAPI, microservices.</p>",
      "updated_at": "2026-05-28T10:00:00Z",
      "departments": [{"name": "Engineering"}],
      "metadata": []
    },
    {
      "id": 4001235,
      "title": "Frontend Engineer",
      "absolute_url": "https://boards.greenhouse.io/swiggy/jobs/4001235",
      "location": {"name": "Bangalore, India"},
      "content": "<p>React, TypeScript</p>",
      "updated_at": "2026-05-28T10:05:00Z",
      "departments": [{"name": "Engineering"}],
      "metadata": []
    }
  ]
}
```

- [ ] **Step 2: Create Lever fixture `backend/tests/fixtures/lever_sample.json`**

```json
[
  {
    "id": "abc-123-def",
    "text": "Senior Backend Engineer",
    "hostedUrl": "https://jobs.lever.co/flexport/abc-123-def",
    "categories": {"location": "San Francisco", "team": "Engineering"},
    "description": "<p>Build the future of freight</p>",
    "descriptionPlain": "Build the future of freight",
    "createdAt": 1717000000000
  }
]
```

- [ ] **Step 3: Write the failing test `backend/tests/test_adapters.py`**

```python
import json
from pathlib import Path

import pytest

from backend.services.discovery_service import (
    NormalizedJob,
    _normalize_greenhouse,
    _normalize_lever,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text())


def test_normalize_greenhouse_extracts_required_fields():
    raw_jobs = _load("greenhouse_sample.json")["jobs"]
    out = [_normalize_greenhouse(j) for j in raw_jobs]

    assert len(out) == 2
    first = out[0]
    assert isinstance(first, NormalizedJob)
    assert first.external_id == "4001234"
    assert first.title == "Backend Engineer"
    assert first.location == "Bangalore, India"
    assert first.job_url == "https://boards.greenhouse.io/swiggy/jobs/4001234"
    # HTML and entities stripped from description
    assert "<p>" not in first.description
    assert "<b>" not in first.description
    assert "&#39;" not in first.description
    assert "backend engineer" in first.description.lower()


def test_normalize_greenhouse_handles_missing_location():
    job = {
        "id": 9999,
        "title": "T",
        "absolute_url": "https://x",
        "content": "<p>hi</p>",
        # no "location" field
    }
    nj = _normalize_greenhouse(job)
    assert nj.location == ""


def test_normalize_lever_extracts_required_fields():
    raw_jobs = _load("lever_sample.json")
    out = [_normalize_lever(j) for j in raw_jobs]

    assert len(out) == 1
    nj = out[0]
    assert nj.external_id == "abc-123-def"
    assert nj.title == "Senior Backend Engineer"
    assert nj.location == "San Francisco"
    assert nj.job_url == "https://jobs.lever.co/flexport/abc-123-def"
    assert "<p>" not in nj.description
    assert "freight" in nj.description.lower()


def test_normalize_lever_prefers_description_plain_when_present():
    job = {
        "id": "x",
        "text": "T",
        "hostedUrl": "https://x",
        "categories": {},
        "description": "<p>HTML version</p>",
        "descriptionPlain": "plain version",
    }
    assert _normalize_lever(job).description == "plain version"
```

- [ ] **Step 4: Run the failing test**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_adapters.py -v
```
Expected: `ImportError` or `ModuleNotFoundError` — `backend.services.discovery_service` doesn't exist yet.

- [ ] **Step 5: Create `backend/services/discovery_service.py` (adapters only)**

```python
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
    # Lever provides both `description` (HTML) and `descriptionPlain`. Prefer plain.
    desc = job.get("descriptionPlain") or _strip_html(job.get("description", ""))
    return NormalizedJob(
        external_id=str(job["id"]),
        title=job.get("text", "").strip(),
        description=desc.strip(),
        location=(cats.get("location") or "").strip(),
        job_url=job.get("hostedUrl", ""),
        raw=job,
    )
```

- [ ] **Step 6: Run the test, expect pass**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_adapters.py -v
```
Expected: `4 passed`.

- [ ] **Step 7: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/discovery_service.py backend/tests/test_adapters.py backend/tests/fixtures/ && git commit -m "Add Greenhouse + Lever job normalization adapters with fixture tests"
```

---

## Task 5: Discovery service — sync logic

Add `fetch_greenhouse`, `fetch_lever`, `sync_company`, `mark_stale_jobs`, `sync_all` to `discovery_service.py`. I/O-heavy; not unit-tested in slice 1 (manual smoke via admin endpoint in later task).

**Files:**
- Modify: `backend/services/discovery_service.py`

- [ ] **Step 1: Append fetch + sync logic to `backend/services/discovery_service.py`**

After the adapters defined in Task 4, append:

```python
import hashlib
from dataclasses import asdict
from datetime import datetime, timezone

import asyncio
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


# ─── Fetchers ─────────────────────────────────────────────────────────────

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


# ─── Per-company upsert ───────────────────────────────────────────────────

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


# ─── Stale sweep ──────────────────────────────────────────────────────────

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


# ─── Top-level orchestrator ───────────────────────────────────────────────

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
```

- [ ] **Step 2: Smoke import — verify no syntax / import errors**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.services.discovery_service import sync_all, SyncStats; print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Re-run adapter tests (regression check that the appended code doesn't break them)**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_adapters.py -v
```
Expected: `4 passed`.

- [ ] **Step 4: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/discovery_service.py && git commit -m "Add discovery_service.sync_all with parallel company sync and stale sweep"
```

---

## Task 6: KeywordMatcher (TDD)

Pure scoring function. Easy to test, no DB.

**Files:**
- Create: `backend/tests/test_matcher_keyword.py`
- Create: `backend/services/matching_service.py` (matcher only; `score_jobs` next task)

- [ ] **Step 1: Write the failing test `backend/tests/test_matcher_keyword.py`**

```python
from types import SimpleNamespace

import pytest

from backend.services.matching_service import KeywordMatcher


def _make_job(title="", description="", location=""):
    return SimpleNamespace(title=title, description=description, location=location)


def _make_settings(role="", keywords="", location=""):
    return SimpleNamespace(role=role, keywords=keywords, location=location)


@pytest.fixture
def matcher():
    return KeywordMatcher()


async def test_no_overlap_yields_zero(matcher):
    job = _make_job(title="Lorem ipsum", description="dolor sit amet")
    settings = _make_settings(role="React engineer", keywords="typescript")
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    assert score == 0.0
    assert matched == []


async def test_full_overlap_clamps_to_one(matcher):
    job = _make_job(
        title="Backend engineer",
        description="Python FastAPI microservices",
        location="Bangalore",
    )
    settings = _make_settings(
        role="backend engineer",
        keywords="python, fastapi, microservices",
        location="Bangalore",
    )
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    assert score == pytest.approx(1.0, abs=1e-6)
    assert "backend" in matched
    assert "python" in matched
    assert "Bangalore" in matched


async def test_location_only_adds_location_weight(matcher):
    job = _make_job(title="Lorem", description="ipsum", location="Bangalore")
    settings = _make_settings(role="", keywords="", location="Bangalore")
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    # location weight = 0.2
    assert score == pytest.approx(0.2)
    assert matched == ["Bangalore"]


async def test_partial_keyword_overlap(matcher):
    job = _make_job(
        title="Backend Engineer",
        description="We need Python skills",
    )
    settings = _make_settings(
        role="backend engineer",
        keywords="python, fastapi",  # only python matches
    )
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    # role: 2 terms ("backend", "engineer"), both match → 0.4 * 2/2 = 0.4
    # keywords: 2 terms ("python", "fastapi"), 1 matches → 0.4 * 1/2 = 0.2
    # total = 0.6
    assert score == pytest.approx(0.6, abs=1e-6)
    assert "python" in matched


async def test_case_insensitive(matcher):
    job = _make_job(title="REACT DEVELOPER", description="")
    settings = _make_settings(role="react developer")
    score, _ = await matcher.score(user=None, settings=settings, job=job)
    assert score > 0


async def test_score_never_exceeds_one(matcher):
    job = _make_job(
        title="python python python",
        description="python python",
        location="Bangalore",
    )
    settings = _make_settings(
        role="python",
        keywords="python",
        location="Bangalore",
    )
    score, _ = await matcher.score(user=None, settings=settings, job=job)
    assert 0.0 <= score <= 1.0
```

- [ ] **Step 2: Run the failing test**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_matcher_keyword.py -v
```
Expected: `ImportError` — module doesn't exist.

- [ ] **Step 3: Create `backend/services/matching_service.py` (matcher only)**

```python
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
```

- [ ] **Step 4: Run the test, expect pass**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_matcher_keyword.py -v
```
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/matching_service.py backend/tests/test_matcher_keyword.py && git commit -m "Add KeywordMatcher with weighted role/keywords/location scoring"
```

---

## Task 7: Matching service — score_jobs orchestration

Adds the bulk-user-load + per-pair scoring orchestrator. I/O-heavy; skip unit tests.

**Files:**
- Modify: `backend/services/matching_service.py`

- [ ] **Step 1: Append orchestrator to `backend/services/matching_service.py`**

After the `KeywordMatcher` class, append:

```python
from collections import defaultdict
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
        In(PlatformSetting.platform, ["greenhouse", "lever"]),
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
    Returns [(User, Job, score, matched_terms), ...] for pairs whose score >= user.notify_threshold."""
    if not job_ids:
        return []

    jobs = await Job.find(
        In(Job.id, job_ids),
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
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.services.matching_service import score_jobs, get_matcher, KeywordMatcher; print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Re-run matcher tests (regression)**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_matcher_keyword.py -v
```
Expected: `6 passed`.

- [ ] **Step 4: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/matching_service.py && git commit -m "Add score_jobs orchestrator with bulk user loading"
```

---

## Task 8: Dispatcher decision logic (TDD)

Extract the auto-apply vs notify decision as a pure function `_decide()`. Unit-testable. Plumbing comes in the next task.

**Files:**
- Create: `backend/tests/test_dispatcher_decision.py`
- Create: `backend/services/match_dispatcher.py` (decide-only in this task)

- [ ] **Step 1: Write the failing test `backend/tests/test_dispatcher_decision.py`**

```python
from backend.services.match_dispatcher import _decide


def test_above_auto_threshold_with_room_returns_auto_apply():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=True,
    )
    assert decision == "auto_apply"


def test_above_auto_but_cap_exhausted_returns_notify():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=0,
        per_platform_room=True,
    )
    assert decision == "notify"


def test_above_auto_but_platform_limit_hit_returns_notify():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=False,
    )
    assert decision == "notify"


def test_between_thresholds_returns_notify():
    # Caller is responsible for only invoking _decide when score >= notify_threshold
    decision = _decide(
        score=0.75,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=True,
    )
    assert decision == "notify"


def test_exactly_at_auto_threshold_qualifies_as_auto_apply():
    decision = _decide(
        score=0.9,
        auto_threshold=0.9,
        discovery_cap_remaining=1,
        per_platform_room=True,
    )
    assert decision == "auto_apply"
```

- [ ] **Step 2: Run the failing test**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_dispatcher_decision.py -v
```
Expected: `ImportError` — module doesn't exist.

- [ ] **Step 3: Create `backend/services/match_dispatcher.py` (decide-only)**

```python
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
```

- [ ] **Step 4: Run the test, expect pass**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_dispatcher_decision.py -v
```
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/match_dispatcher.py backend/tests/test_dispatcher_decision.py && git commit -m "Add _decide pure helper for dispatcher with TDD coverage"
```

---

## Task 9: Dispatcher — orchestration

Append the full `dispatch` orchestrator that uses `_decide` and the existing `application_service` for daily counts. I/O-heavy; no new unit tests.

**Files:**
- Modify: `backend/services/match_dispatcher.py`

- [ ] **Step 1: Append to `backend/services/match_dispatcher.py`**

```python
import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from backend.models import (
    Application,
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
    # Schedule a logging task (we're inside a done_callback, can't await directly).
    asyncio.ensure_future(
        log_service.log(
            run_id="apply:unhandled",
            platform="system",
            level="error",
            message=f"unhandled task exception: {exc!r}",
            user_id=None,
        )
    )


async def _user_email(user_id: str) -> str:
    from beanie import PydanticObjectId
    try:
        u = await User.get(PydanticObjectId(user_id))
        return u.email if u else ""
    except Exception:
        return ""


async def _count_discovery_applies_today(user_id: str) -> int:
    """Count Greenhouse+Lever applies for this user today."""
    # Reuse existing per-platform helper — sum across ats platforms.
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
        items.sort(key=lambda t: t[2], reverse=True)  # best matches first
        await _dispatch_for_user(user_id, items)


async def _dispatch_for_user(user_id: str, items: list[tuple]) -> None:
    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
    if g is None:
        return

    discovery_today = await _count_discovery_applies_today(user_id)
    cap_remaining = max(0, g.discovery_daily_cap - discovery_today)

    for user, job, score, matched in items:
        # Idempotency — unique index also catches, this skips cheaper
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
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.services.match_dispatcher import dispatch, _decide; print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Re-run decision tests (regression)**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/test_dispatcher_decision.py -v
```
Expected: `5 passed`.

- [ ] **Step 4: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/match_dispatcher.py && git commit -m "Add dispatch orchestrator with per-user cap + idempotency guard"
```

---

## Task 10: `AtsApplyBot` base class

Abstract base for single-job ATS apply flows. Parallel to `BaseBot`; does not inherit.

**Files:**
- Create: `backend/bots/ats_base.py`

- [ ] **Step 1: Create `backend/bots/ats_base.py`**

```python
"""Single-job apply base for public ATS forms (Greenhouse, Lever).

Differs from BaseBot: no login, no search loop, one job per invocation.
Subclasses implement `fill_and_submit(page)` only.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod

from backend.bots._constants import USER_AGENT
from backend.models import Job, Profile
from backend.services import application_service, log_service


def _headless() -> bool:
    return os.getenv("HIRERAFT_ENV", "development") != "development"


class AtsApplyBot(ABC):
    ats: str = ""

    def __init__(
        self,
        run_id: str,
        user_id: str,
        job: Job,
        profile: Profile,
        resume_path: str,
    ):
        self.run_id = run_id
        self.user_id = user_id
        self.job = job
        self.profile = profile
        self.resume_path = resume_path

    @abstractmethod
    async def fill_and_submit(self, page) -> bool:
        ...

    async def _log(self, level: str, msg: str) -> None:
        await log_service.log(self.run_id, self.ats, level, msg, self.user_id)

    async def run(self) -> bool:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=_headless(),
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                response = await page.goto(self.job.job_url, wait_until="domcontentloaded")
                if response is not None and response.status == 404:
                    await self._log("warn", "job closed before apply (404)")
                    return False

                ok = await self.fill_and_submit(page)
                if ok:
                    await application_service.save_application(
                        self.job.title,
                        self.job.company_name,
                        self.ats,
                        self.job.job_url,
                        self.user_id,
                    )
                return ok
            except Exception as e:
                await self._log("error", f"bot crashed: {e}")
                return False
            finally:
                await browser.close()
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.bots.ats_base import AtsApplyBot; print(AtsApplyBot)"
```
Expected: `<class 'backend.bots.ats_base.AtsApplyBot'>`.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/bots/ats_base.py && git commit -m "Add AtsApplyBot abstract base for single-job ATS form submission"
```

---

## Task 11: GreenhouseBot

Concrete subclass for Greenhouse-hosted forms.

**Files:**
- Create: `backend/bots/greenhouse.py`

- [ ] **Step 1: Create `backend/bots/greenhouse.py`**

```python
"""Greenhouse apply bot — fills the public form at boards.greenhouse.io/<slug>/jobs/<id>."""

from __future__ import annotations

from backend.bots.ats_base import AtsApplyBot


APPLY_SELECTORS = [
    "button[data-mapped-qa='apply-button']",   # stable Greenhouse QA hook
    "text=Apply for this Job",
    "text=Apply Now",
    "text=Apply Here",
    "text=Submit Application",
]


class GreenhouseBot(AtsApplyBot):
    ats = "greenhouse"

    async def fill_and_submit(self, page) -> bool:
        # 1. Click the "apply" button via selector cascade.
        clicked = False
        for sel in APPLY_SELECTORS:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                clicked = True
                break
        if not clicked:
            await self._log("error", "no apply button found")
            return False

        # 2. Fill standard fields. Profile may be missing pieces — fail
        # gracefully on the required ones (name, email, phone).
        if not self.profile.full_name or not self.profile.phone:
            await self._log("error", "profile incomplete (full_name or phone missing)")
            return False

        from backend.services.match_dispatcher import _user_email
        email = await _user_email(self.user_id)
        if not email:
            await self._log("error", "no user email")
            return False

        name_parts = self.profile.full_name.split(maxsplit=1)
        first = name_parts[0]
        last = name_parts[1] if len(name_parts) > 1 else ""

        try:
            await page.fill('input[autocomplete="given-name"]', first)
            await page.fill('input[autocomplete="family-name"]', last)
            await page.fill('input[type="email"]', email)
            await page.fill('input[autocomplete="tel"]', self.profile.phone)
            await page.set_input_files('input[type="file"]', self.resume_path)
        except Exception as e:
            await self._log("error", f"failed to fill standard fields: {e}")
            return False

        if self.profile.linkedin_url:
            try:
                await page.fill('input[name*="linkedin"]', self.profile.linkedin_url)
            except Exception:
                pass  # field may not exist on every board

        # 3. Detect required custom questions; fail if any are unanswered.
        required_unanswered = await page.locator(
            '[aria-required="true"]:not([value]):not(:has(option:checked))'
        ).count()
        if required_unanswered > 0:
            await self._log(
                "warn",
                f"{required_unanswered} required custom questions — skipping (slice-1 limitation)",
            )
            return False

        # 4. Submit and confirm.
        try:
            await page.click('button[type="submit"]')
        except Exception as e:
            await self._log("error", f"submit click failed: {e}")
            return False

        try:
            await page.wait_for_url("**/confirmation**", timeout=20_000)
            return True
        except Exception:
            screenshot_path = f"/tmp/hireraft_failed_{self.run_id}.png"
            try:
                await page.screenshot(path=screenshot_path)
                await self._log(
                    "error",
                    f"confirmation page never loaded; screenshot at {screenshot_path}",
                )
            except Exception:
                await self._log("error", "confirmation page never loaded; screenshot also failed")
            return False
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.bots.greenhouse import GreenhouseBot; print(GreenhouseBot.ats)"
```
Expected: `greenhouse`.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/bots/greenhouse.py && git commit -m "Add GreenhouseBot with apply-button cascade and confirmation timeout screenshot"
```

---

## Task 12: LeverBot

Same shape as Greenhouse, Lever-specific selectors.

**Files:**
- Create: `backend/bots/lever.py`

- [ ] **Step 1: Create `backend/bots/lever.py`**

```python
"""Lever apply bot — fills the public form at jobs.lever.co/<slug>/<id>/apply."""

from __future__ import annotations

from backend.bots.ats_base import AtsApplyBot


# Lever's apply page is a URL hop from the listing page; some are inline.
APPLY_BUTTON_SELECTORS = [
    "a[data-qa='btn-apply-bottom']",
    "a.template-btn-submit",
    "text=Apply for this job",
    "text=Apply",
]


class LeverBot(AtsApplyBot):
    ats = "lever"

    async def fill_and_submit(self, page) -> bool:
        # Lever sometimes shows an "Apply" button that navigates to /apply,
        # sometimes the form is inline. Try the cascade; if none match,
        # assume we're already on the form page.
        for sel in APPLY_BUTTON_SELECTORS:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await page.wait_for_load_state("domcontentloaded")
                break

        if not self.profile.full_name or not self.profile.phone:
            await self._log("error", "profile incomplete (full_name or phone missing)")
            return False

        from backend.services.match_dispatcher import _user_email
        email = await _user_email(self.user_id)
        if not email:
            await self._log("error", "no user email")
            return False

        try:
            await page.fill('input[name="name"]', self.profile.full_name)
            await page.fill('input[name="email"]', email)
            await page.fill('input[name="phone"]', self.profile.phone)
            await page.set_input_files('input[name="resume"]', self.resume_path)
        except Exception as e:
            await self._log("error", f"failed to fill standard fields: {e}")
            return False

        if self.profile.linkedin_url:
            try:
                await page.fill('input[name="urls[LinkedIn]"]', self.profile.linkedin_url)
            except Exception:
                pass

        required_unanswered = await page.locator(
            '[aria-required="true"]:not([value]):not(:has(option:checked))'
        ).count()
        if required_unanswered > 0:
            await self._log(
                "warn",
                f"{required_unanswered} required custom questions — skipping (slice-1 limitation)",
            )
            return False

        try:
            await page.click('button[type="submit"]')
        except Exception as e:
            await self._log("error", f"submit click failed: {e}")
            return False

        try:
            await page.wait_for_url("**/thanks**", timeout=20_000)
            return True
        except Exception:
            screenshot_path = f"/tmp/hireraft_failed_{self.run_id}.png"
            try:
                await page.screenshot(path=screenshot_path)
                await self._log(
                    "error",
                    f"confirmation (thanks) page never loaded; screenshot at {screenshot_path}",
                )
            except Exception:
                await self._log("error", "confirmation page never loaded; screenshot also failed")
            return False
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.bots.lever import LeverBot; print(LeverBot.ats)"
```
Expected: `lever`.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/bots/lever.py && git commit -m "Add LeverBot mirroring Greenhouse shape with Lever selectors"
```

---

## Task 13: Extend bot_runner with `ATS_BOT_MAP` and `run_one_job`

**Files:**
- Modify: `backend/services/bot_runner.py`

- [ ] **Step 1: Append to `backend/services/bot_runner.py`**

```python
# --- slice-1 discovery additions ----------------------------------------

from backend.bots.ats_base import AtsApplyBot
from backend.bots.greenhouse import GreenhouseBot
from backend.bots.lever import LeverBot
from backend.models import Job, Profile, GlobalSetting


ATS_BOT_MAP: dict[str, type[AtsApplyBot]] = {
    "greenhouse": GreenhouseBot,
    "lever": LeverBot,
}


async def run_one_job(ats: str, run_id: str, user_id: str, job: Job) -> bool:
    """Single-job apply flow for ATS-discovered postings."""
    bot_cls = ATS_BOT_MAP.get(ats)
    if bot_cls is None:
        await log_service.log(run_id, ats, "error", f"no bot for ats={ats}", user_id)
        return False

    profile = await Profile.find_one(Profile.user_id == user_id)
    if profile is None:
        await log_service.log(run_id, ats, "error", "no profile — complete profile to enable auto-apply", user_id)
        return False

    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
    if g is None or not g.resume_path:
        await log_service.log(run_id, ats, "error", "no resume uploaded", user_id)
        return False

    bot = bot_cls(run_id=run_id, user_id=user_id, job=job, profile=profile, resume_path=g.resume_path)
    return await bot.run()
```

- [ ] **Step 2: Smoke import**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.services.bot_runner import run_one_job, ATS_BOT_MAP; print(list(ATS_BOT_MAP))"
```
Expected: `['greenhouse', 'lever']`.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/services/bot_runner.py && git commit -m "Extend bot_runner with ATS_BOT_MAP and run_one_job for discovery applies"
```

---

## Task 14: Scheduler hook — hourly `discovery_cycle`

**Files:**
- Modify: `backend/scheduler.py`

- [ ] **Step 1: Replace `backend/scheduler.py` with the extended version**

Current content (after the earlier Beanie port) is:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler: AsyncIOScheduler | None = None


async def scheduled_run():
    from backend.models import GlobalSetting
    from backend.services.bot_runner import run_all_enabled_platforms

    settings = await GlobalSetting.find(GlobalSetting.schedule_enabled == True).to_list()  # noqa: E712
    user_ids = [s.user_id for s in settings if s.user_id]

    for uid in user_ids:
        await run_all_enabled_platforms(uid)


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        scheduled_run,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_auto_apply",
        replace_existing=True,
    )
    _scheduler.start()
    return _scheduler


def reschedule(time_str: str):
    if _scheduler is None:
        return
    hour, minute = map(int, time_str.split(":"))
    _scheduler.reschedule_job(
        "daily_auto_apply",
        trigger=CronTrigger(hour=hour, minute=minute),
    )
```

Replace with:
```python
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.services import log_service

_scheduler: AsyncIOScheduler | None = None


async def scheduled_run():
    from backend.models import GlobalSetting
    from backend.services.bot_runner import run_all_enabled_platforms

    settings = await GlobalSetting.find(GlobalSetting.schedule_enabled == True).to_list()  # noqa: E712
    user_ids = [s.user_id for s in settings if s.user_id]

    for uid in user_ids:
        await run_all_enabled_platforms(uid)


async def discovery_cycle():
    """Hourly: poll ATS APIs, score new jobs, dispatch matches."""
    from backend.services import discovery_service, matching_service, match_dispatcher

    run_id = f"discovery_cycle:{int(datetime.now(timezone.utc).timestamp())}"
    await log_service.log(run_id, "system", "info", "discovery cycle start", None)

    stats = await discovery_service.sync_all()
    candidates = await matching_service.score_jobs(
        stats.new_job_ids + stats.changed_job_ids
    )
    await match_dispatcher.dispatch(candidates)

    await log_service.log(
        run_id,
        "system",
        "info",
        (
            f"cycle done — {stats.jobs_new} new, {stats.jobs_updated} updated, "
            f"{stats.jobs_closed} closed, {len(candidates)} candidates dispatched"
        ),
        None,
    )


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler()

    # Existing daily LinkedIn-style sweep — unchanged
    _scheduler.add_job(
        scheduled_run,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_auto_apply",
        replace_existing=True,
    )

    # Hourly ATS discovery + match + dispatch
    _scheduler.add_job(
        discovery_cycle,
        trigger=IntervalTrigger(hours=1),
        id="discovery_cycle",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=10),
    )

    _scheduler.start()
    return _scheduler


def reschedule(time_str: str):
    if _scheduler is None:
        return
    hour, minute = map(int, time_str.split(":"))
    _scheduler.reschedule_job(
        "daily_auto_apply",
        trigger=CronTrigger(hour=hour, minute=minute),
    )
```

- [ ] **Step 2: Boot backend to confirm scheduler starts cleanly**

```bash
cd ~/personal/hireraft && ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!
sleep 4
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8001/docs
kill $BACKEND_PID
wait $BACKEND_PID 2>/dev/null
```
Expected: `HTTP 200`. (The 10-second `next_run_time` means the cycle might also fire — that's fine, it'll either complete or fail gracefully because no Companies are seeded yet.)

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/scheduler.py && git commit -m "Wire discovery_cycle into hourly scheduler with coalesce + max_instances=1"
```

---

## Task 15: Admin API — Companies CRUD + seed + sync trigger

**Files:**
- Modify: `backend/schemas.py` (add Pydantic schemas)
- Modify: `backend/api/admin.py`

- [ ] **Step 1: Add schemas to `backend/schemas.py`**

Append to `backend/schemas.py`:

```python
from datetime import datetime

class CompanyRead(BaseModel):
    id: str
    name: str
    ats: str
    slug: str
    active: bool
    last_synced_at: datetime | None
    last_sync_error: str
    created_at: datetime


class CompanyCreate(BaseModel):
    name: str
    ats: str   # "greenhouse" | "lever"
    slug: str


class CompanyUpdate(BaseModel):
    active: bool | None = None
    name: str | None = None
    slug: str | None = None


class CompanySeedItem(BaseModel):
    name: str
    ats: str
    slug: str
```

(If `BaseModel` isn't imported at the top of the file, add `from pydantic import BaseModel`.)

- [ ] **Step 2: Add admin endpoints to `backend/api/admin.py`**

Append to `backend/api/admin.py`:

```python
import json
from pathlib import Path

from fastapi import HTTPException
from backend.models import Company, User
from backend.schemas import CompanyRead, CompanyCreate, CompanyUpdate, CompanySeedItem


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


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin only")


@router.get("/admin/companies", response_model=list[CompanyRead])
async def list_companies(
    ats: str | None = None,
    active: bool | None = None,
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    query: dict = {}
    if ats is not None:
        query["ats"] = ats
    if active is not None:
        query["active"] = active
    companies = await Company.find(query).to_list()
    return [_company_to_read(c) for c in companies]


@router.post("/admin/companies", response_model=CompanyRead)
async def create_company(body: CompanyCreate, user: User = Depends(get_current_user)):
    _require_admin(user)
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
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    from beanie import PydanticObjectId
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
async def delete_company(cid: str, user: User = Depends(get_current_user)):
    _require_admin(user)
    from beanie import PydanticObjectId
    co = await Company.get(PydanticObjectId(cid))
    if co is None:
        raise HTTPException(404, "not found")
    await co.delete()
    return {"ok": True}


@router.post("/admin/companies/seed")
async def seed_companies(user: User = Depends(get_current_user)):
    """Idempotent — upserts on (ats, slug) from backend/data/companies.json."""
    _require_admin(user)
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
async def trigger_sync(user: User = Depends(get_current_user)):
    """Manual trigger for the full discovery cycle. Dev/debug aid."""
    _require_admin(user)
    from backend.scheduler import discovery_cycle
    import asyncio
    asyncio.create_task(discovery_cycle())
    return {"ok": True, "message": "discovery cycle scheduled"}
```

If `router` / `Depends` / `get_current_user` aren't already imported at the top of `admin.py`, ensure they are. (Typical pattern in this repo: `from fastapi import APIRouter, Depends; from backend.auth import get_current_user; router = APIRouter(tags=["admin"])`.)

- [ ] **Step 3: Boot backend and hit /docs to confirm endpoints are mounted**

```bash
cd ~/personal/hireraft && ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!
sleep 4
curl -sS http://127.0.0.1:8001/openapi.json | ./venv/bin/python -c "import sys, json; ops = json.load(sys.stdin)['paths']; print('\n'.join(p for p in ops if '/admin/companies' in p or '/admin/discovery' in p))"
kill $BACKEND_PID
wait $BACKEND_PID 2>/dev/null
```
Expected output includes:
```
/api/admin/companies
/api/admin/companies/{cid}
/api/admin/companies/seed
/api/admin/discovery/sync
```

- [ ] **Step 4: Commit**

```bash
cd ~/personal/hireraft && git add backend/api/admin.py backend/schemas.py && git commit -m "Add admin endpoints: companies CRUD, seed loader, manual discovery sync trigger"
```

---

## Task 16: Discovery API — user-facing router

Mounted at `/api/discovery/`.

**Files:**
- Modify: `backend/schemas.py`
- Create: `backend/api/discovery.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add schemas to `backend/schemas.py`**

Append:

```python
class MatchFeedItem(BaseModel):
    id: str
    job_title: str
    company_name: str
    location: str
    job_url: str
    ats: str
    score: float
    matched_terms: list[str]
    decision: str       # "auto_apply" | "notify"
    state: str          # "pending" | "applied" | "failed" | "dismissed"
    created_at: datetime
    applied_at: datetime | None


class DiscoveryStats(BaseModel):
    total_matches: int
    applied: int
    pending_notify: int
    failed: int
    dismissed: int
```

- [ ] **Step 2: Create `backend/api/discovery.py`**

```python
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
    """Manual apply trigger: used both for notify-decision matches the user clicks,
    and for retrying failed matches."""
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

    # Fetch all active job IDs and dispatch through the normal pipeline.
    active_jobs = await Job.find(Job.status == "active").to_list()
    job_ids = [str(j.id) for j in active_jobs]

    run_id = f"rematch:{uuid.uuid4().hex[:8]}"
    await log_service.log(run_id, "system", "info", f"manual rematch by user {uid} over {len(job_ids)} jobs", uid)

    from backend.services import matching_service, match_dispatcher
    candidates = await matching_service.score_jobs(job_ids)
    # Filter to just this user's candidates — score_jobs returns all users
    my_candidates = [c for c in candidates if str(c[0].id) == uid]
    await match_dispatcher.dispatch(my_candidates)

    return {"ok": True, "scored_jobs": len(job_ids), "matches": len(my_candidates)}
```

- [ ] **Step 3: Mount the discovery router in `backend/main.py`**

Add to the imports near the other `router as ..._router` imports:
```python
from backend.api.discovery import router as discovery_router
```

Add this line with the other `app.include_router(..., prefix="/api")` calls:
```python
app.include_router(discovery_router, prefix="/api")
```

- [ ] **Step 4: Boot backend and verify endpoints**

```bash
cd ~/personal/hireraft && ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!
sleep 4
curl -sS http://127.0.0.1:8001/openapi.json | ./venv/bin/python -c "import sys, json; ops = json.load(sys.stdin)['paths']; print('\n'.join(p for p in ops if '/discovery' in p))"
kill $BACKEND_PID
wait $BACKEND_PID 2>/dev/null
```
Expected output includes (at minimum):
```
/api/discovery/feed
/api/discovery/stats
/api/discovery/matches/{mid}/apply
/api/discovery/matches/{mid}/dismiss
/api/discovery/rematch
```

- [ ] **Step 5: Commit**

```bash
cd ~/personal/hireraft && git add backend/api/discovery.py backend/schemas.py backend/main.py && git commit -m "Add user-facing discovery API: feed, stats, apply, dismiss, rematch"
```

---

## Task 17: Seed companies file

A small, realistic starter list. Engineer can grow it later.

**Files:**
- Create: `backend/data/companies.json`

- [ ] **Step 1: Create `backend/data/companies.json`**

```json
[
  {"name": "Stripe", "ats": "greenhouse", "slug": "stripe"},
  {"name": "Airbnb", "ats": "greenhouse", "slug": "airbnb"},
  {"name": "Coinbase", "ats": "greenhouse", "slug": "coinbase"},
  {"name": "Notion", "ats": "greenhouse", "slug": "notion"},
  {"name": "Anthropic", "ats": "greenhouse", "slug": "anthropic"},
  {"name": "OpenAI", "ats": "greenhouse", "slug": "openai"},
  {"name": "DoorDash", "ats": "greenhouse", "slug": "doordash"},
  {"name": "Robinhood", "ats": "greenhouse", "slug": "robinhood"},
  {"name": "Figma", "ats": "greenhouse", "slug": "figma"},
  {"name": "Postman", "ats": "greenhouse", "slug": "postman"},
  {"name": "Flexport", "ats": "lever", "slug": "flexport"},
  {"name": "Brex", "ats": "lever", "slug": "brex"},
  {"name": "Mercury", "ats": "lever", "slug": "mercury"},
  {"name": "Ramp", "ats": "lever", "slug": "ramp"},
  {"name": "Linear", "ats": "lever", "slug": "linear"}
]
```

Replace/augment with real Indian-startup slugs as needed — these are placeholders that may or may not all be live on the named ATS at any moment. The seed endpoint is idempotent, so re-running is safe.

- [ ] **Step 2: Validate JSON**

```bash
cd ~/personal/hireraft && ./venv/bin/python -c "import json; data = json.load(open('backend/data/companies.json')); print(f'{len(data)} entries; ats counts:', {a: sum(1 for d in data if d[\"ats\"] == a) for a in {d[\"ats\"] for d in data}})"
```
Expected: e.g. `15 entries; ats counts: {'greenhouse': 10, 'lever': 5}`.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add backend/data/companies.json && git commit -m "Seed: 10 Greenhouse + 5 Lever starter companies for discovery"
```

---

## Task 18: Frontend API client — add discovery methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Append types + methods to `frontend/src/lib/api.ts`**

Near the existing interface declarations, add:

```ts
export interface CompanyRead {
  id: string
  name: string
  ats: string
  slug: string
  active: boolean
  last_synced_at: string | null
  last_sync_error: string
  created_at: string
}

export interface MatchFeedItem {
  id: string
  job_title: string
  company_name: string
  location: string
  job_url: string
  ats: string
  score: number
  matched_terms: string[]
  decision: 'auto_apply' | 'notify'
  state: 'pending' | 'applied' | 'failed' | 'dismissed'
  created_at: string
  applied_at: string | null
}

export interface DiscoveryStats {
  total_matches: number
  applied: number
  pending_notify: number
  failed: number
  dismissed: number
}
```

Then, inside the `api` object (or wherever other endpoint methods live), append:

```ts
  // Discovery (user-facing)
  getDiscoveryFeed: (state?: string, page = 1, limit = 50): Promise<MatchFeedItem[]> =>
    request(`/discovery/feed?${new URLSearchParams({
      ...(state ? { state } : {}),
      page: String(page),
      limit: String(limit),
    })}`),
  getDiscoveryStats: (): Promise<DiscoveryStats> => request('/discovery/stats'),
  applyMatch: (id: string) =>
    request(`/discovery/matches/${id}/apply`, { method: 'POST' }),
  dismissMatch: (id: string) =>
    request(`/discovery/matches/${id}/dismiss`, { method: 'POST' }),
  rematch: () => request('/discovery/rematch', { method: 'POST' }),

  // Admin: companies
  listCompanies: (ats?: string): Promise<CompanyRead[]> =>
    request(`/admin/companies${ats ? `?ats=${ats}` : ''}`),
  createCompany: (body: { name: string; ats: string; slug: string }): Promise<CompanyRead> =>
    request('/admin/companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCompany: (id: string, body: { active?: boolean; name?: string; slug?: string }): Promise<CompanyRead> =>
    request(`/admin/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCompany: (id: string) =>
    request(`/admin/companies/${id}`, { method: 'DELETE' }),
  seedCompanies: () => request('/admin/companies/seed', { method: 'POST' }),
  triggerDiscoverySync: () => request('/admin/discovery/sync', { method: 'POST' }),
```

- [ ] **Step 2: Type-check**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -30
```
Expected: zero errors (or only pre-existing ones unrelated to the new code).

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add frontend/src/lib/api.ts && git commit -m "Add discovery + admin-companies methods to frontend API client"
```

---

## Task 19: Frontend — Discovery feed page

**Files:**
- Create: `frontend/src/pages/Discovery.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Discovery.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, MatchFeedItem } from '../lib/api'
import { format } from 'date-fns'

const STATE_TABS: Array<{ key: string; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'applied', label: 'Applied' },
  { key: 'failed', label: 'Failed' },
  { key: 'dismissed', label: 'Dismissed' },
]

export default function Discovery() {
  const qc = useQueryClient()
  const [activeState, setActiveState] = useState<string>('pending')

  const { data: feed, isLoading } = useQuery({
    queryKey: ['discovery-feed', activeState],
    queryFn: () => api.getDiscoveryFeed(activeState),
    refetchOnWindowFocus: true,
  })

  const { data: stats } = useQuery({
    queryKey: ['discovery-stats'],
    queryFn: api.getDiscoveryStats,
  })

  const applyMut = useMutation({
    mutationFn: (id: string) => api.applyMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-feed'] })
      qc.invalidateQueries({ queryKey: ['discovery-stats'] })
    },
  })

  const dismissMut = useMutation({
    mutationFn: (id: string) => api.dismissMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-feed'] })
      qc.invalidateQueries({ queryKey: ['discovery-stats'] })
    },
  })

  const rematchMut = useMutation({
    mutationFn: api.rematch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery-feed'] }),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Discovery</h1>
          {stats && (
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {stats.total_matches} total · {stats.applied} applied · {stats.pending_notify} pending · {stats.failed} failed
            </p>
          )}
        </div>
        <button
          onClick={() => rematchMut.mutate()}
          disabled={rematchMut.isPending}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm disabled:opacity-50"
        >
          {rematchMut.isPending ? 'Rematching…' : 'Rematch all open jobs'}
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-[var(--border)]">
        {STATE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveState(t.key)}
            className={`px-4 py-2 text-sm border-b-2 ${
              activeState === t.key
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-[var(--text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && (!feed || feed.length === 0) && (
        <p className="text-[var(--text-muted)] text-center py-12">No matches in this bucket yet.</p>
      )}
      <div className="space-y-3">
        {feed?.map((m: MatchFeedItem) => (
          <div key={m.id} className="border border-[var(--border)] rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1">
              <a
                href={m.job_url}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-medium hover:underline"
              >
                {m.job_title}
              </a>
              <p className="text-sm text-[var(--text-muted)]">
                {m.company_name} · {m.location || '—'} · {m.ats}
              </p>
              <p className="text-xs mt-2">
                <span className="font-semibold">Score:</span> {m.score.toFixed(2)} ·{' '}
                <span className="font-semibold">Matched:</span> {m.matched_terms.slice(0, 5).join(', ') || '—'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {format(new Date(m.created_at), 'MMM d, HH:mm')}
                {m.applied_at && ` · Applied: ${format(new Date(m.applied_at), 'MMM d, HH:mm')}`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                  m.decision === 'auto_apply' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {m.decision}
              </span>
              {(m.state === 'pending' || m.state === 'failed') && m.decision !== 'auto_apply' && (
                <button
                  onClick={() => applyMut.mutate(m.id)}
                  disabled={applyMut.isPending}
                  className="px-3 py-1 text-xs rounded bg-brand-500 text-white disabled:opacity-50"
                >
                  Apply
                </button>
              )}
              {m.state === 'failed' && m.decision === 'auto_apply' && (
                <button
                  onClick={() => applyMut.mutate(m.id)}
                  disabled={applyMut.isPending}
                  className="px-3 py-1 text-xs rounded bg-brand-500 text-white disabled:opacity-50"
                >
                  Retry
                </button>
              )}
              {m.state !== 'applied' && m.state !== 'dismissed' && (
                <button
                  onClick={() => dismissMut.mutate(m.id)}
                  className="px-3 py-1 text-xs rounded border border-[var(--border)] text-[var(--text-muted)]"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -20
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add frontend/src/pages/Discovery.tsx && git commit -m "Add Discovery feed page with state tabs, apply/dismiss, rematch"
```

---

## Task 20: Frontend — Admin Companies page

**Files:**
- Create: `frontend/src/pages/admin/AdminCompanies.tsx`

- [ ] **Step 1: Create `frontend/src/pages/admin/AdminCompanies.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CompanyRead } from '../../lib/api'
import { format } from 'date-fns'

export default function AdminCompanies() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [ats, setAts] = useState<'greenhouse' | 'lever'>('greenhouse')
  const [slug, setSlug] = useState('')

  const { data: companies, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.listCompanies(),
  })

  const createMut = useMutation({
    mutationFn: () => api.createCompany({ name, ats, slug }),
    onSuccess: () => {
      setName(''); setSlug('')
      qc.invalidateQueries({ queryKey: ['admin-companies'] })
    },
  })

  const toggleMut = useMutation({
    mutationFn: (c: CompanyRead) => api.updateCompany(c.id, { active: !c.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCompany(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const seedMut = useMutation({
    mutationFn: api.seedCompanies,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const syncMut = useMutation({
    mutationFn: api.triggerDiscoverySync,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Companies</h1>
        <div className="flex gap-2">
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="px-3 py-2 text-sm rounded-xl border border-[var(--border)] disabled:opacity-50"
          >
            {seedMut.isPending ? 'Seeding…' : 'Seed from JSON'}
          </button>
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="px-3 py-2 text-sm rounded-xl bg-brand-500 text-white disabled:opacity-50"
          >
            {syncMut.isPending ? 'Triggering…' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ATS</label>
          <select value={ats} onChange={(e) => setAts(e.target.value as 'greenhouse' | 'lever')} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent">
            <option value="greenhouse">greenhouse</option>
            <option value="lever">lever</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent" placeholder="e.g. swiggy" />
        </div>
        <button
          onClick={() => createMut.mutate()}
          disabled={!name || !slug || createMut.isPending}
          className="px-3 py-2 text-sm rounded-xl bg-brand-500 text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {isLoading && <p>Loading…</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
          <tr>
            <th className="py-2">Name</th>
            <th>ATS</th>
            <th>Slug</th>
            <th>Active</th>
            <th>Last synced</th>
            <th>Error</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {companies?.map((c) => (
            <tr key={c.id} className="border-b border-[var(--border)]/40">
              <td className="py-2">{c.name}</td>
              <td>{c.ats}</td>
              <td className="font-mono text-xs">{c.slug}</td>
              <td>
                <button
                  onClick={() => toggleMut.mutate(c)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    c.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {c.active ? 'active' : 'paused'}
                </button>
              </td>
              <td className="text-xs">
                {c.last_synced_at ? format(new Date(c.last_synced_at), 'MMM d HH:mm') : '—'}
              </td>
              <td className="text-xs text-red-400 max-w-xs truncate">{c.last_sync_error || ''}</td>
              <td>
                <button
                  onClick={() => deleteMut.mutate(c.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -20
```
Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
cd ~/personal/hireraft && git add frontend/src/pages/admin/AdminCompanies.tsx && git commit -m "Add admin Companies page with CRUD, seed, and manual sync trigger"
```

---

## Task 21: Wire new pages into routing + nav

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Import the new pages**

Add to the imports near the top of `App.tsx`:
```tsx
import Discovery from './pages/Discovery'
import AdminCompanies from './pages/admin/AdminCompanies'
```

- [ ] **Step 2: Add nav entry**

Locate the `NAV` array and add a "Discovery" entry between Automation and Logs. Use the `Compass` lucide icon (or any sensible one). Replace the NAV constant:

```tsx
import {
  LayoutDashboard, Bot, ScrollText, LogOut, UserCircle,
  Menu, X, Zap, Bell, ShieldAlert, Compass
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/automation', label: 'Automation', icon: Bot },
  { to: '/discovery', label: 'Discovery', icon: Compass },
  { to: '/logs', label: 'Logs', icon: ScrollText },
]
```

- [ ] **Step 3: Add user-facing route**

Inside the `<Route element={<ProtectedLayout />}>` block, add (alongside `dashboard`, `profile`, `automation`, `logs`):
```tsx
        <Route path="discovery" element={<Discovery />} />
```

- [ ] **Step 4: Add admin route**

Inside the `<Route path="/admin" element={<AdminLayout />}>` block, add (alongside `dashboard`, `users`, `activity`, `analytics`):
```tsx
        <Route path="companies" element={<AdminCompanies />} />
```

- [ ] **Step 5: Type-check + frontend build smoke**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -20
```
Expected: zero new errors.

- [ ] **Step 6: Commit**

```bash
cd ~/personal/hireraft && git add frontend/src/App.tsx && git commit -m "Wire Discovery page into nav + Admin Companies route"
```

---

## Task 22: Settings — Discovery section

Add a small section to the Settings page for the discovery toggle + thresholds + cap.

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/lib/api.ts` (extend the `GlobalSetting` interface and update endpoint)

- [ ] **Step 1: Extend `GlobalSetting` interface in `frontend/src/lib/api.ts`**

Locate the existing `GlobalSetting` interface and extend:

```ts
export interface GlobalSetting {
  id: string
  resume_path: string
  schedule_time: string
  schedule_enabled: boolean
  discovery_enabled: boolean
  auto_apply_threshold: number
  notify_threshold: number
  discovery_daily_cap: number
}
```

The existing `updateGlobalSettings` method (or equivalent) should accept these fields with no further change — but if the function is typed strictly, widen the body type to include the four new optional fields.

- [ ] **Step 2: Read Settings.tsx to confirm its state-management pattern**

```bash
cd ~/personal/hireraft && grep -n "useState\|useForm\|globalSettings\|schedule_time" frontend/src/pages/Settings.tsx | head -20
```
Look for whether the page uses a single `useState` object (most common in this repo's style), individual `useState` per field, or `react-hook-form`. The code block below assumes a single `form` state object — adapt the field accesses (`form.X` / `setForm((f) => ({...}))`) to whatever pattern Settings.tsx actually uses.

- [ ] **Step 3: Add the section to `frontend/src/pages/Settings.tsx`**

Locate the form that handles `schedule_time` / `schedule_enabled` / `resume_path`. Below the existing schedule section (or wherever a new Card-style block fits naturally), add:

```tsx
{/* --- Discovery section (slice 1) --- */}
<section className="border border-[var(--border)] rounded-xl p-5 space-y-4">
  <header>
    <h2 className="text-lg font-semibold">Discovery (Greenhouse + Lever)</h2>
    <p className="text-xs text-[var(--text-muted)]">
      Auto-apply settings for jobs found by the discovery engine.
    </p>
  </header>

  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={form.discovery_enabled ?? true}
      onChange={(e) => setForm((f) => ({ ...f, discovery_enabled: e.target.checked }))}
    />
    <span className="text-sm">Enable discovery for my account</span>
  </label>

  <div>
    <label className="block text-xs font-semibold mb-1">
      Auto-apply threshold: {(form.auto_apply_threshold ?? 0.9).toFixed(2)}
    </label>
    <input
      type="range"
      min={0.5}
      max={1.0}
      step={0.05}
      value={form.auto_apply_threshold ?? 0.9}
      onChange={(e) =>
        setForm((f) => ({ ...f, auto_apply_threshold: parseFloat(e.target.value) }))
      }
      className="w-full"
    />
    <p className="text-xs text-[var(--text-muted)]">
      Matches at or above this score will be applied automatically.
    </p>
  </div>

  <div>
    <label className="block text-xs font-semibold mb-1">
      Notify threshold: {(form.notify_threshold ?? 0.6).toFixed(2)}
    </label>
    <input
      type="range"
      min={0.3}
      max={0.95}
      step={0.05}
      value={form.notify_threshold ?? 0.6}
      onChange={(e) =>
        setForm((f) => ({ ...f, notify_threshold: parseFloat(e.target.value) }))
      }
      className="w-full"
    />
    <p className="text-xs text-[var(--text-muted)]">
      Below-auto matches at or above this score will appear in your feed.
    </p>
  </div>

  <div>
    <label className="block text-xs font-semibold mb-1">
      Daily auto-apply cap (Greenhouse + Lever combined)
    </label>
    <input
      type="number"
      min={0}
      max={200}
      value={form.discovery_daily_cap ?? 20}
      onChange={(e) =>
        setForm((f) => ({ ...f, discovery_daily_cap: parseInt(e.target.value, 10) || 0 }))
      }
      className="px-2 py-1 rounded border border-[var(--border)] bg-transparent w-32"
    />
  </div>
</section>
```

**The key invariant:** the four new fields (`discovery_enabled`, `auto_apply_threshold`, `notify_threshold`, `discovery_daily_cap`) must end up in the body the Save button sends to whichever PATCH endpoint already updates GlobalSetting (search `api.ts` for "updateGlobalSetting" or similar to find it).

- [ ] **Step 4: Type-check**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -20
```
Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
cd ~/personal/hireraft && git add frontend/src/pages/Settings.tsx frontend/src/lib/api.ts && git commit -m "Settings: add Discovery section with thresholds and daily cap"
```

---

## Task 23: Admin observability tiles (spec §12)

Three numeric tiles on the admin dashboard: jobs synced today, matches dispatched today, 7-day auto-apply success rate.

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/api/admin.py`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`

- [ ] **Step 1: Add response schema to `backend/schemas.py`**

Append:

```python
class DiscoveryObservability(BaseModel):
    jobs_new_today: int
    matches_dispatched_today: int
    auto_apply_success_rate_7d: float | None     # None when denominator is zero
    auto_apply_attempts_7d: int
    auto_apply_succeeded_7d: int
```

- [ ] **Step 2: Add endpoint to `backend/api/admin.py`**

Append:

```python
from datetime import datetime, timedelta, timezone

from backend.models import Job, JobMatch
from backend.schemas import DiscoveryObservability


@router.get("/admin/discovery/observability", response_model=DiscoveryObservability)
async def discovery_observability(user: User = Depends(get_current_user)):
    _require_admin(user)
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

    rate: float | None = None
    if auto_attempts > 0:
        rate = round(auto_succeeded / auto_attempts, 3)

    return DiscoveryObservability(
        jobs_new_today=jobs_new_today,
        matches_dispatched_today=matches_dispatched_today,
        auto_apply_success_rate_7d=rate,
        auto_apply_attempts_7d=auto_attempts,
        auto_apply_succeeded_7d=auto_succeeded,
    )
```

- [ ] **Step 3: Add type + client method to `frontend/src/lib/api.ts`**

Add the interface near the other discovery types:

```ts
export interface DiscoveryObservability {
  jobs_new_today: number
  matches_dispatched_today: number
  auto_apply_success_rate_7d: number | null
  auto_apply_attempts_7d: number
  auto_apply_succeeded_7d: number
}
```

Add the method to the `api` object:

```ts
  getDiscoveryObservability: (): Promise<DiscoveryObservability> =>
    request('/admin/discovery/observability'),
```

- [ ] **Step 4: Read AdminDashboard.tsx and identify where to insert tiles**

```bash
cd ~/personal/hireraft && head -80 frontend/src/pages/admin/AdminDashboard.tsx
```
Identify the existing tile/card grid (most admin dashboards in this repo use a CSS grid of `Card`-style divs). The three new tiles go in that same grid.

- [ ] **Step 5: Add tiles to `frontend/src/pages/admin/AdminDashboard.tsx`**

Near the existing stats fetch, add:

```tsx
const { data: obs } = useQuery({
  queryKey: ['discovery-observability'],
  queryFn: api.getDiscoveryObservability,
  refetchInterval: 60_000,
})
```

In the tile grid (place alongside the existing stat tiles — match their styling exactly), add three tiles:

```tsx
<div className="border border-[var(--border)] rounded-xl p-4">
  <p className="text-xs uppercase text-[var(--text-muted)]">Jobs new today</p>
  <p className="text-2xl font-bold mt-1">{obs?.jobs_new_today ?? '—'}</p>
</div>
<div className="border border-[var(--border)] rounded-xl p-4">
  <p className="text-xs uppercase text-[var(--text-muted)]">Matches dispatched today</p>
  <p className="text-2xl font-bold mt-1">{obs?.matches_dispatched_today ?? '—'}</p>
</div>
<div className="border border-[var(--border)] rounded-xl p-4">
  <p className="text-xs uppercase text-[var(--text-muted)]">Auto-apply success rate (7d)</p>
  <p className="text-2xl font-bold mt-1">
    {obs?.auto_apply_success_rate_7d == null
      ? '—'
      : `${(obs.auto_apply_success_rate_7d * 100).toFixed(1)}%`}
  </p>
  <p className="text-[10px] text-[var(--text-muted)] mt-1">
    {obs?.auto_apply_succeeded_7d ?? 0} / {obs?.auto_apply_attempts_7d ?? 0} attempts
  </p>
</div>
```

If the existing tile grid uses a different className, copy that exact className to the new tiles for visual consistency.

- [ ] **Step 6: Type-check + backend smoke**

```bash
cd ~/personal/hireraft/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tail -10
cd ~/personal/hireraft && ./venv/bin/python -c "from backend.api.admin import discovery_observability; print('ok')"
```
Expected: no TS errors; `ok`.

- [ ] **Step 7: Commit**

```bash
cd ~/personal/hireraft && git add backend/api/admin.py backend/schemas.py frontend/src/lib/api.ts frontend/src/pages/admin/AdminDashboard.tsx && git commit -m "Admin: three discovery observability tiles (jobs new, matches dispatched, success rate 7d)"
```

---

## Task 24: Full-stack smoke test (spec §14 walkthrough)

Run the manual test plan from the spec to validate end-to-end behavior. This task **does not** produce code; it validates that the previous 22 tasks compose correctly. Document any failures as new tasks.

**Files:** none modified. This is verification.

- [ ] **Step 1: Run all unit tests**

```bash
cd ~/personal/hireraft && ./venv/bin/pytest backend/tests/ -v
```
Expected: all tests pass (4 adapter + 6 matcher + 5 decision = 15 tests).

- [ ] **Step 2: Start backend + frontend in two terminals**

Terminal 1:
```bash
cd ~/personal/hireraft && ./venv/bin/uvicorn backend.main:app --reload
```
Expected: "Application startup complete." with no errors.

Terminal 2:
```bash
cd ~/personal/hireraft/frontend && npm run dev
```
Expected: "VITE ... ready" with `Local: http://localhost:5173/`.

- [ ] **Step 3: Promote your account to admin**

```bash
cd ~/personal/hireraft && ./venv/bin/python create_admin.py
```
Then log into the frontend at http://localhost:5173 with `admin@hireraft.com` / `admin`, or update `create_admin.py` to elevate your real account.

- [ ] **Step 4: Manual test plan — execute each step from spec §14**

Spec section 14 enumerates 8 steps; run each and verify:

1. **Seed companies.** Navigate to `/admin/companies`. Click "Seed from JSON". Expect 15 companies listed with `active=true` and `last_synced_at=null`.
2. **Wait ~70 seconds** (10s warmup + give the first hourly cycle some time to run). Refresh `/admin/companies` — `last_synced_at` should now be populated for each company (or `last_sync_error` populated for any that returned 404, which is fine for placeholder slugs). Check the Logs page — expect `discovery cycle start` and `cycle done — N new, ...` entries.
3. **Configure a test user.** Navigate to Settings → Discovery section. Set thresholds and cap. Navigate to Automation, add a `greenhouse` platform row with keywords matching one of the seeded postings (e.g., role="engineer", keywords="python, react"). Enable the platform.
4. **Trigger rematch.** Open the Discovery page. Click "Rematch all open jobs". Expect feed to populate with at least a few matches scored in the [0.6, 1.0] range.
5. **Test auto-apply path** (only with a real, non-placeholder Greenhouse company you've added that genuinely has matching jobs and you're prepared to actually apply to). Pick a `notify`-decision match, click Apply → verify a Chrome window opens, fills the form, submits. After ~30s, refresh feed — match should show `state=applied` and `applied_at` populated. Verify Dashboard's "Applications" tab also lists the new row.
6. **Test cap downgrade.** In Settings, set `discovery_daily_cap=1`. Trigger rematch. Verify at most 1 match shows `decision=auto_apply`; the rest are `decision=notify`.
7. **Test failure path.** In Settings, clear the resume (or temporarily upload a path that doesn't exist on disk by editing the GlobalSetting in Mongo directly: `db.global_settings.updateOne({user_id:"..."},{$set:{resume_path:"/nope.pdf"}})`). Trigger apply on a notify match → verify `state=failed` and Logs page shows `no resume uploaded`. Note: cap consumed regardless.
8. **Test rematch cooldown.** Click "Rematch all open jobs" twice in quick succession. Expect the second click to surface a 429 error in the browser network tab (frontend should display via the existing error toast).

- [ ] **Step 5: Final verification — clean git status**

```bash
cd ~/personal/hireraft && git status
```
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 6: Push (when ready)**

```bash
cd ~/personal/hireraft && git log --oneline -25
```
Review the new commits. When satisfied:

```bash
cd ~/personal/hireraft && git push origin main
```
Expected: clean push to `git@github.com-personal:ShivamPratap16/hireraft.git`.

---

## Slice 1 done. Out-of-scope follow-ups for later slices:

- Career-page polling (~100 hand-picked Indian startups)
- Embedding/LLM matcher (drop-in via the existing `Matcher` Protocol)
- AI-fill for required custom questions
- Per-user company watchlists
- DB-integration tests + CI
- The pre-existing `/ws/logs` path bug discovered during the earlier run (frontend connects to `ws://.../ws/logs` but backend mounts at `/api/ws/logs`) — separate from this slice; file as its own ticket
