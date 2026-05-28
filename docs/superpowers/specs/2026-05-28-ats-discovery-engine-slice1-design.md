# ATS Discovery Engine — Slice 1 Design

**Date:** 2026-05-28
**Status:** Approved for implementation
**Scope:** Slice 1 of the broader job-discovery roadmap — Greenhouse + Lever public ATS APIs only.

---

## 1. Goals & non-goals

### Goals

- Continuously discover jobs posted via the **Greenhouse** and **Lever** public ATS APIs from an admin-curated list of companies.
- Match each new posting against every user's existing `PlatformSetting` (role, keywords, location) and produce a numeric fit score.
- Surface high-confidence matches as **auto-applies** through a new ATS-form-filling bot; surface medium-confidence matches as **notifications**; ignore the rest.
- Keep the change isolated to two new bot classes, three new service files, three new collections, and one new admin/user-facing page each — no rewiring of the existing LinkedIn/Indeed/Naukri/Internshala flow.

### Non-goals (deferred to later slices)

- Career-page polling (Zepto, Meesho, CRED, etc.) via Playwright.
- Google search sweep and RSS feed ingestion.
- Embedding-based or LLM-based matching (the interface is designed for swap-in later).
- Per-user company watchlists — slice 1 polls one global admin list for everyone.
- Cover-letter generation, AI-fill for custom ATS questions, smart resume tailoring.
- DB integration tests, Playwright bot tests, CI.

---

## 2. Architecture overview

```
                       ┌─────────────────────────┐
                       │  Admin: Companies page  │
                       └─────────────┬───────────┘
                                     │ CRUD via /api/admin/companies
                                     ▼
                       ┌─────────────────────────┐
                       │   Company collection    │
                       │  {name, ats, slug, …}   │
                       └─────────────┬───────────┘
                                     │ read
                                     ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Scheduler — IntervalTrigger(hours=1)                        │
   │                                                              │
   │  discovery_cycle()                                           │
   │    ├─ stats = await discovery_service.sync_all()             │
   │    ├─ candidates = await matching_service.score_jobs(        │
   │    │     stats.new_job_ids + stats.changed_job_ids)          │
   │    └─ await match_dispatcher.dispatch(candidates)            │
   └──────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                       ┌─────────────────────────┐
                       │  bots/greenhouse.py     │
                       │  bots/lever.py          │
                       │  (subclass AtsApplyBot) │
                       └─────────────┬───────────┘
                                     │ writes
                                     ▼
                       ┌─────────────────────────┐
                       │  Application collection │
                       │  (existing — unchanged) │
                       └─────────────────────────┘
```

Three new services (`discovery_service`, `matching_service`, `match_dispatcher`), two new bots (`GreenhouseBot`, `LeverBot`), one new base (`AtsApplyBot`), three new collections (`Company`, `Job`, `JobMatch`), and one extra cron job. The existing 9 AM daily LinkedIn-style sweep remains untouched and runs in parallel.

Job and Application are intentionally separate collections: `Job` is the global record of "this posting exists right now"; `Application` (existing) is the per-user record of "this user applied to it." Auto-apply writes `Application` rows via the existing `application_service.save_application()` so the existing dedup, daily-limit, and notification logic is **reused, not duplicated**.

No queue or event bus. The hourly cron is the only async boundary; everything inside it is sequential within a single `asyncio` run.

---

## 3. Data model

All new documents are Beanie `Document` subclasses, registered in `backend/database.py:init_db`.

### 3.1 New collections

**`companies`** — admin-curated source of truth for what to poll.

```python
class Company(Document):
    name: str
    ats: str                                  # "greenhouse" | "lever"
    slug: Indexed(str)                        # ATS-specific slug, e.g. "swiggy"
    active: bool = True
    last_synced_at: datetime | None = None
    last_sync_error: str = ""
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "companies"
        indexes = [IndexModel([("ats", 1), ("slug", 1)], unique=True)]
```

**`jobs`** — global, deduped postings.

```python
class Job(Document):
    external_id: Indexed(str, unique=True)    # "greenhouse:swiggy:4001234"
    ats: str                                   # "greenhouse" | "lever"
    company_slug: str
    company_name: str                          # denormalized for fast reads
    title: str
    description: str = ""                      # plain text, HTML stripped on ingest
    description_hash: str = ""                 # md5 of description, skip re-writes
    location: str = ""
    job_url: str
    status: str = "active"                     # "active" | "closed"
    first_seen_at: datetime = Field(default_factory=utcnow)
    last_seen_at: datetime = Field(default_factory=utcnow)
    closed_at: datetime | None = None
    raw: dict = Field(default_factory=dict)    # original API payload for debugging

    class Settings:
        name = "jobs"
        indexes = ["status", "ats", [("company_slug", 1), ("status", 1)]]
```

**`job_matches`** — persisted only for actionable scores (≥ user's notify threshold). Below-threshold pairs are not stored.

```python
class JobMatch(Document):
    user_id: Indexed(str)
    job_id: str
    score: float                               # 0.0 – 1.0
    matched_terms: list[str] = []              # explanation: ["react","bangalore"]
    decision: str                              # immutable: "auto_apply" | "notify"
    state: str = "pending"                     # mutable: pending|applied|failed|dismissed
    created_at: datetime = Field(default_factory=utcnow)
    applied_at: datetime | None = None

    class Settings:
        name = "job_matches"
        indexes = [
            IndexModel([("user_id", 1), ("job_id", 1)], unique=True),
            "state",
        ]
```

`decision` is set once by the dispatcher and never changes. `state` tracks the lifecycle: `pending` → `applied`/`failed` (auto-apply path), or `pending` → `applied`/`dismissed` (notify path).

### 3.2 Existing collections

**`GlobalSetting`** — add four fields. (`GlobalSetting` is per-user despite the name; every row has `user_id` indexed.)

```python
discovery_enabled: bool = True
auto_apply_threshold: float = 0.9     # >= this → auto-apply
notify_threshold: float = 0.6         # >= this (but < auto) → notify
discovery_daily_cap: int = 20         # max ATS-discovery auto-applies per day
last_rematch_at: datetime | None = None   # cooldown for manual rematch endpoint
```

**`PlatformSetting`** — no schema change. Users get new rows with `platform="greenhouse"` and `platform="lever"` so they configure keywords/role/location/experience the same way they configure LinkedIn today. `enabled` gates discovery per-ATS.

**`Application`** — no schema change. Greenhouse/Lever applies write rows with `platform="greenhouse"` etc.; existing `application_service.daily_count(platform, user_id)` works without modification.

### 3.3 Matcher interface

```python
class Matcher(Protocol):
    async def score(
        self, user: User, settings: PlatformSetting, job: Job
    ) -> tuple[float, list[str]]:
        """Returns (score in [0,1], explanation_terms)."""
```

The Protocol is the swap-later boundary. Slice 1 ships `KeywordMatcher`; future slices can swap to embeddings or LLM scoring with a one-line change in `matching_service` and no DB migration.

---

## 4. Discovery service

**File:** `backend/services/discovery_service.py`

### 4.1 Public API

```python
async def sync_all() -> SyncStats:
    """Poll every active Company, upsert Jobs, mark stale jobs closed."""
```

### 4.2 Flow

```
sync_all()
  │
  ├─ sync_started_at = utcnow()
  ├─ companies = await Company.find(Company.active == True).to_list()
  │
  ├─ results = await asyncio.gather(
  │              *(sync_company(c) for c in companies),
  │              return_exceptions=True)
  │     ▲  parallel, ~20-30 concurrent. The return_exceptions=True is
  │        load-bearing — without it, one bad adapter kills sibling tasks.
  │
  └─ mark_stale_jobs(threshold=sync_started_at)
```

### 4.3 Adapters

```python
@dataclass
class NormalizedJob:
    external_id: str
    title: str
    description: str        # plain text, HTML stripped
    location: str
    job_url: str
    raw: dict

async def fetch_greenhouse(slug: str) -> list[NormalizedJob]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    r = await httpx.get(url, timeout=30.0)
    r.raise_for_status()
    return [_normalize_greenhouse(j) for j in r.json()["jobs"]]

async def fetch_lever(slug: str) -> list[NormalizedJob]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    r = await httpx.get(url, timeout=30.0)
    r.raise_for_status()
    return [_normalize_lever(j) for j in r.json()]

ADAPTERS = {"greenhouse": fetch_greenhouse, "lever": fetch_lever}
```

All ATS-specific quirks die at the adapter boundary. Downstream code is ATS-agnostic.

### 4.4 Per-company upsert

```python
async def sync_company(co: Company) -> tuple[list[str], list[str]]:
    """Returns (new_job_ids, changed_job_ids)."""
    try:
        live_jobs = await ADAPTERS[co.ats](co.slug)
    except Exception as e:
        co.last_sync_error = str(e)[:500]
        await co.save()
        return [], []

    now = utcnow()
    live_ids = [f"{co.ats}:{co.slug}:{nj.external_id}" for nj in live_jobs]

    # Bulk fetch — one query, not N
    existing_map = {
        j.external_id: j
        for j in await Job.find(In(Job.external_id, live_ids)).to_list()
    }

    new_ids, changed_ids = [], []
    for nj in live_jobs:
        ext_id = f"{co.ats}:{co.slug}:{nj.external_id}"
        new_hash = md5(nj.description.encode()).hexdigest()
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
                external_id=ext_id, ats=co.ats,
                company_slug=co.slug, company_name=co.name,
                title=nj.title, description=nj.description,
                description_hash=new_hash,
                location=nj.location, job_url=nj.job_url,
                first_seen_at=now, last_seen_at=now,
                raw=nj.raw,
            ).insert()
            new_ids.append(str(created.id))

    co.last_synced_at = now
    co.last_sync_error = ""
    await co.save()
    return new_ids, changed_ids
```

### 4.5 Stale-job sweep

```python
async def mark_stale_jobs(threshold: datetime):
    """Any active job not seen in this cycle → closed."""
    await Job.find(
        Job.status == "active",
        Job.last_seen_at < threshold,
    ).update({"$set": {"status": "closed", "closed_at": utcnow()}})
```

Using `sync_started_at` (the moment the cycle began) as the threshold prevents a race where a slow sync closes jobs from companies it hasn't reached yet.

### 4.6 Return type

```python
@dataclass
class SyncStats:
    companies_synced: int
    companies_failed: int
    jobs_new: int
    jobs_updated: int
    jobs_closed: int
    new_job_ids: list[str]
    changed_job_ids: list[str]
```

---

## 5. Matching service

**File:** `backend/services/matching_service.py`

### 5.1 Public API

```python
async def score_jobs(
    job_ids: list[str],
) -> list[tuple[User, Job, float, list[str]]]:
    """Score the given jobs against every discovery-enabled user.
    Returns pairs whose score >= that user's notify_threshold."""
```

### 5.2 KeywordMatcher

```python
class KeywordMatcher:
    WEIGHTS = {"role": 0.4, "keywords": 0.4, "location": 0.2}

    async def score(self, user, settings, job) -> tuple[float, list[str]]:
        haystack = f"{job.title} {job.description} {job.location}".lower()
        matched: list[str] = []
        score = 0.0

        role_terms = _tokenize(settings.role)
        for term in role_terms:
            if term in haystack:
                score += self.WEIGHTS["role"] / max(1, len(role_terms))
                matched.append(term)

        kw_terms = _tokenize(settings.keywords)
        for term in kw_terms:
            if term in haystack:
                score += self.WEIGHTS["keywords"] / max(1, len(kw_terms))
                matched.append(term)

        if settings.location and settings.location.lower() in haystack:
            score += self.WEIGHTS["location"]
            matched.append(settings.location)

        return min(score, 1.0), matched
```

Weights are intentionally not user-configurable. Surface in admin only if/when data demands it.

### 5.3 Bulk user load (no N+1)

```python
async def _load_active_discovery_users() -> list[tuple[User, list[PlatformSetting], GlobalSetting]]:
    users = await User.find(User.is_blocked == False).to_list()
    ids = [str(u.id) for u in users]

    settings = await PlatformSetting.find(
        In(PlatformSetting.user_id, ids),
        In(PlatformSetting.platform, ["greenhouse", "lever"]),
        PlatformSetting.enabled == True,
    ).to_list()
    globals_ = await GlobalSetting.find(
        In(GlobalSetting.user_id, ids),
        GlobalSetting.discovery_enabled == True,
    ).to_list()

    settings_by_user = defaultdict(list)
    for s in settings:
        settings_by_user[s.user_id].append(s)
    globals_by_user = {g.user_id: g for g in globals_}

    return [
        (u, settings_by_user[str(u.id)], globals_by_user[str(u.id)])
        for u in users
        if str(u.id) in globals_by_user and settings_by_user[str(u.id)]
    ]
```

### 5.4 Filtering at the matcher boundary

`score_jobs` only returns pairs whose `score >= notify_threshold`. Sub-threshold pairs never reach the dispatcher and are never persisted. This is what prevents `job_matches` from bloating with irrelevant rows.

---

## 6. Match dispatcher

**File:** `backend/services/match_dispatcher.py`

### 6.1 Public API

```python
async def dispatch(candidates: list[tuple[User, Job, float, list[str]]]):
    """For each candidate, decide action, write JobMatch, fire bot or notify."""
```

### 6.2 Flow

```python
async def dispatch(candidates):
    by_user: dict[str, list] = defaultdict(list)
    for user, job, score, matched in candidates:
        by_user[str(user.id)].append((user, job, score, matched))

    for user_id, items in by_user.items():
        items.sort(key=lambda t: t[2], reverse=True)  # best matches first
        await _dispatch_for_user(user_id, items)


async def _dispatch_for_user(user_id: str, items: list):
    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)

    discovery_today = await _count_discovery_applies_today(user_id)
    cap_remaining = max(0, g.discovery_daily_cap - discovery_today)

    for user, job, score, matched in items:
        if await JobMatch.find_one(
            JobMatch.user_id == user_id, JobMatch.job_id == str(job.id),
        ):
            continue  # idempotency — unique index also catches, this skips cheaper

        per_platform_ok = (
            await application_service.daily_count(job.ats, user_id)
            < (await _get_platform_settings(user_id, job.ats)).daily_limit
        )
        can_auto = (
            score >= g.auto_apply_threshold
            and cap_remaining > 0
            and per_platform_ok
        )
        decision = "auto_apply" if can_auto else "notify"

        match = await JobMatch(
            user_id=user_id, job_id=str(job.id),
            score=score, matched_terms=matched,
            decision=decision, state="pending",
        ).insert()

        if decision == "auto_apply":
            cap_remaining -= 1  # consumed at dispatch, NOT at apply success
            task = asyncio.create_task(_run_apply(user_id, job, match))
            task.add_done_callback(_log_unhandled_task_exception)
        else:
            await create_notification(
                user_id, "info",
                f"New match: {job.title} @ {job.company_name}",
                f"Score {score:.2f} — {', '.join(matched[:3])}",
            )


async def _run_apply(user_id: str, job: Job, match: JobMatch):
    run_id = f"apply:{uuid.uuid4().hex[:8]}"
    try:
        ok = await bot_runner.run_one_job(job.ats, run_id, user_id, job)
        match.state = "applied" if ok else "failed"
        if ok:
            match.applied_at = utcnow()
    except Exception as e:
        match.state = "failed"
        await log_service.log(run_id, job.ats, "error", f"Match {match.id} crashed: {e}", user_id)
    await match.save()
```

### 6.3 Key decisions

- **Best matches consume the cap first** (sort by score descending) so a user's best 20 matches auto-apply, not the first 20 returned by Mongo.
- **Cap is decremented at dispatch time, not at apply success.** A failed apply burns the cap. Rationale: avoids retry storms against flaky ATS endpoints; user sees failed matches in the feed and can manually retry.
- **Cap-exhausted matches downgrade to `notify`, not silent drop.** User never loses visibility into a match.
- **`add_done_callback`** ensures task exceptions are logged even if the task is garbage-collected before completion.
- **Per-platform daily limit is checked alongside the discovery cap** — both must have room for auto-apply to fire. Uses the existing `application_service.daily_count` — single source of truth.

---

## 7. ATS apply bots

### 7.1 `AtsApplyBot` base — `backend/bots/ats_base.py`

`BaseBot` doesn't fit ATS forms: it assumes login → search → loop. ATS forms have no login, one job per invocation, no iteration. New parallel base:

```python
class AtsApplyBot(ABC):
    ats: str = ""

    def __init__(self, run_id, user_id, job: Job, profile: Profile, resume_path: str):
        self.run_id, self.user_id = run_id, user_id
        self.job, self.profile, self.resume_path = job, profile, resume_path

    @abstractmethod
    async def fill_and_submit(self, page) -> bool: ...

    async def _log(self, level, msg):
        await log_service.log(self.run_id, self.ats, level, msg, self.user_id)

    async def run(self) -> bool:
        from playwright.async_api import async_playwright
        HEADLESS = os.getenv("HIRERAFT_ENV", "development") != "development"

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=HEADLESS,
                args=["--disable-blink-features=AutomationControlled"],
            )
            # USER_AGENT — reuse the same string BaseBot uses; consider moving
            # to a shared constants module in this slice to avoid duplication.
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                response = await page.goto(self.job.job_url, wait_until="domcontentloaded")
                if response and response.status == 404:
                    await self._log("warn", "job closed before apply (404)")
                    return False
                ok = await self.fill_and_submit(page)
                if ok:
                    await application_service.save_application(
                        self.job.title, self.job.company_name,
                        self.ats, self.job.job_url, self.user_id,
                    )
                return ok
            except Exception as e:
                await self._log("error", f"bot crashed: {e}")
                return False
            finally:
                await browser.close()
```

### 7.2 `GreenhouseBot` — `backend/bots/greenhouse.py`

```python
APPLY_SELECTORS = [
    "button[data-mapped-qa='apply-button']",   # stable QA hook (primary)
    "text=Apply for this Job",
    "text=Apply Now",
    "text=Apply Here",
    "text=Submit Application",
]

class GreenhouseBot(AtsApplyBot):
    ats = "greenhouse"

    async def fill_and_submit(self, page) -> bool:
        # Cascade through known apply-button variants
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

        name_parts = self.profile.full_name.split(maxsplit=1)
        await page.fill('input[autocomplete="given-name"]', name_parts[0] if name_parts else "")
        await page.fill('input[autocomplete="family-name"]', name_parts[1] if len(name_parts) > 1 else "")
        await page.fill('input[type="email"]', await _user_email(self.user_id))
        await page.fill('input[autocomplete="tel"]', self.profile.phone)
        await page.set_input_files('input[type="file"]', self.resume_path)
        if self.profile.linkedin_url:
            try:
                await page.fill('input[name*="linkedin"]', self.profile.linkedin_url)
            except Exception:
                pass  # linkedin field may not exist on every board

        # Detect required custom questions; fail gracefully if unanswerable.
        required_unanswered = await page.locator(
            '[aria-required="true"]:not([value]):not(:has(option:checked))'
        ).count()
        if required_unanswered > 0:
            await self._log("warn", f"{required_unanswered} required custom questions — skipping")
            return False

        await page.click('button[type="submit"]')

        try:
            await page.wait_for_url("**/confirmation**", timeout=20000)
            return True
        except TimeoutError:
            screenshot_path = f"/tmp/hireraft_failed_{self.run_id}.png"
            try:
                await page.screenshot(path=screenshot_path)
                await self._log("error", f"confirmation never loaded; screenshot {screenshot_path}")
            except Exception:
                await self._log("error", "confirmation never loaded; screenshot failed")
            return False
```

### 7.3 `LeverBot` — `backend/bots/lever.py`

Same skeleton as Greenhouse with Lever-specific selectors. The Lever form lives at `jobs.lever.co/<slug>/<id>/apply` (one URL hop) with fields named `name`, `email`, `phone`, `resume`, `urls[LinkedIn]`. Apply-button cascade and confirmation-page detection follow the same pattern.

### 7.4 Bot dispatch — `bot_runner.py` additions

```python
ATS_BOT_MAP: dict[str, type[AtsApplyBot]] = {
    "greenhouse": GreenhouseBot,
    "lever": LeverBot,
}

async def run_one_job(ats: str, run_id: str, user_id: str, job: Job) -> bool:
    bot_cls = ATS_BOT_MAP.get(ats)
    if bot_cls is None:
        await log_service.log(run_id, ats, "error", f"no bot for {ats}", user_id)
        return False

    profile = await Profile.find_one(Profile.user_id == user_id) or Profile(user_id=user_id)
    g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
    if not g or not g.resume_path:
        await log_service.log(run_id, ats, "error", "no resume uploaded", user_id)
        return False

    return await bot_cls(run_id, user_id, job, profile, g.resume_path).run()
```

`ATS_BOT_MAP` is intentionally separate from the existing `BOT_MAP` — different value types (`type[AtsApplyBot]` vs `type[BaseBot]`) and different call sites.

Helper functions referenced in this section that are implementation details, not design decisions: `_user_email(user_id)` — one-liner that looks up `User.email` by id; `_log_unhandled_task_exception` — done-callback that calls `log_service.log` if `task.exception() is not None`.

---

## 8. Scheduler hook

`backend/scheduler.py` (already Beanie-only after the SQLAlchemy port) gets one new interval job:

```python
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

    # NEW — hourly ATS discovery + match + dispatch
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


async def discovery_cycle():
    run_id = f"discovery_cycle:{int(utcnow().timestamp())}"
    await log_service.log(run_id, "system", "info", "discovery cycle start", None)
    stats = await discovery_service.sync_all()
    candidates = await matching_service.score_jobs(
        stats.new_job_ids + stats.changed_job_ids
    )
    await match_dispatcher.dispatch(candidates)
    await log_service.log(
        run_id, "system", "info",
        f"cycle done — {stats.jobs_new} new, {stats.jobs_updated} updated, "
        f"{stats.jobs_closed} closed, {len(candidates)} candidates",
        None,
    )
```

`coalesce=True, max_instances=1` prevents overlapping triggers from queuing if a cycle ever overruns the hour. `next_run_time` shortly after boot is dev convenience; production can drop it.

---

## 9. API surface

### 9.1 Admin — extends existing `admin_router`

```
GET    /api/admin/companies?ats=&active=&limit=&page=
POST   /api/admin/companies                     # {name, ats, slug}
PATCH  /api/admin/companies/{id}                # {active?, name?, slug?}
DELETE /api/admin/companies/{id}
POST   /api/admin/companies/seed                # idempotent bulk-load companies.json
POST   /api/admin/discovery/sync                # manual trigger of discovery_cycle (dev/debug)
```

### 9.2 User-facing — new `discovery_router` mounted at `/api/discovery`

```
GET    /api/discovery/feed?state=pending&limit=50&page=1
POST   /api/discovery/matches/{id}/apply         # manual trigger for notify or failed matches
POST   /api/discovery/matches/{id}/dismiss
GET    /api/discovery/stats                      # {total, applied, pending_notify, failed}
POST   /api/discovery/rematch                    # backfill: rescore all open Jobs for current user
```

`POST /matches/{id}/apply` handles two paths with the same endpoint: a user clicking "Apply" on a `notify`-decision match, and a user manually retrying a `failed` match.

### 9.3 Rematch cooldown

`POST /api/discovery/rematch` enforces a 5-minute cooldown per user via `GlobalSetting.last_rematch_at`:

```python
g = await GlobalSetting.find_one(GlobalSetting.user_id == user_id)
if g.last_rematch_at and (utcnow() - g.last_rematch_at).total_seconds() < 300:
    raise HTTPException(429, detail="Rematch cooldown — try in a few minutes")
g.last_rematch_at = utcnow()
await g.save()
# proceed to rematch
```

### 9.4 Feed response — denormalized

`GET /api/discovery/feed` returns flat objects rather than raw `JobMatch` documents, to avoid an N+1 fetch on the frontend:

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
    decision: str           # "auto_apply" | "notify"
    state: str              # "pending" | "applied" | "failed" | "dismissed"
    created_at: datetime
    applied_at: datetime | None
```

Implemented as two bulk queries (one for `JobMatch`, one for the referenced `Job` ids) plus an in-memory join.

---

## 10. Frontend touchpoints

Minimal — slice 1 keeps UI deliberately thin:

- **New page `pages/Discovery.tsx`** — feed of `MatchFeedItem` cards (title, company, location, score, matched terms, decision badge, state). Buttons: "Apply" (calls `POST /matches/{id}/apply`), "Dismiss". Added to nav between **Automation** and **Logs**.
- **New page `pages/admin/AdminCompanies.tsx`** — table + add form. CRUD against `/api/admin/companies`.
- **Settings page** — new "Discovery" tab section: enable toggle, two threshold sliders, `discovery_daily_cap` numeric input. Saves to `/api/settings/global` (existing endpoint, just gains fields).

No real-time updates required — existing WebSocket log stream already receives discovery-cycle logs because `_log` writes through `log_service`. Feed page refreshes on focus via React Query.

---

## 11. Error handling

| Failure | Where | Behavior |
|---|---|---|
| ATS API 5xx / timeout / network error | `sync_company` | Catch, write to `Company.last_sync_error`, skip — next hour retries |
| ATS API schema change (KeyError in adapter) | `_normalize_*` | Caught by `return_exceptions=True` in `gather`; sibling tasks unaffected |
| Playwright launch crash | `AtsApplyBot.run` | `try/finally browser.close()`, `state="failed"`, cap stays consumed |
| Resume file missing | `bot_runner.run_one_job` | Fail fast before browser launch, `state="failed"`. Cap is consumed (consistent with "all auto-apply attempts burn cap"). User sees "no resume uploaded" in feed + receives notification to complete profile |
| Profile incomplete (no name/phone) | `AtsApplyBot.fill_and_submit` | Bot returns `False`, `state="failed"`, notification "Complete your profile" |
| Required custom question on form | `fill_and_submit` | Detect via `[aria-required="true"]:not([value])`, return `False` |
| `Job` closed between dispatch and bot run | `page.goto` returns 404 | Explicit `response.status == 404` check, `state="failed"`, log "job closed before apply" |
| Confirmation page never loads | `wait_for_url` timeout | Screenshot to `/tmp/hireraft_failed_{run_id}.png`, log path, return `False` |
| User edits keywords mid-sync | matching_service | No special handling — in-flight sync uses its snapshot; next cycle uses fresh values |
| Duplicate `JobMatch` insertion | dispatcher | Unique index catches; dispatcher's preflight `find_one` skips before the write |
| `discovery_cycle` overruns the hour | scheduler | `coalesce=True, max_instances=1` skips overlap, no queuing |

The single most important error-handling line in the design is **`return_exceptions=True`** in `asyncio.gather` inside `sync_all` — without it, a single misbehaving adapter would kill all sibling company syncs in the same cycle.

The dispatcher does **not** roll back `discovery_daily_cap` on bot failure — a failed apply burns the cap as if successful. Rationale: prevents retry storms against flaky ATS endpoints; failed matches are visible in the feed with a "Retry" button.

---

## 12. Observability

All new code logs through the existing `log_service.log(run_id, platform, level, message, user_id)`. Three `run_id` scopes:

- `discovery_cycle:<unix-ts>` — system-level cycle logs (`user_id=None`)
- `apply:<uuid>` — per-job apply attempts (per-user)
- Existing per-platform `run_id` unchanged for LinkedIn/Indeed sweeps

Structured log events emitted at each major step (in addition to free-text logs):

- `discovery.cycle.start` / `discovery.cycle.complete` with `SyncStats` JSON
- `discovery.dispatch.decision` with `(user_id, job_id, score, decision)`
- `discovery.apply.outcome` with `(ats, success: bool, duration_ms)`

Admin dashboard adds three tiles powered by aggregations over the above:

- Jobs synced today
- Matches dispatched today
- Apply success rate (7-day rolling)

System-scoped logs (where `user_id is None`) need their own viewer: `GET /api/admin/logs/system?run_id=` extends the existing `logs` router with a filter.

---

## 13. Testing strategy

The repo has zero tests at slice 1 start (per `CLAUDE.md`). Slice 1 introduces only the minimum tests needed to validate the non-obvious logic.

### 13.1 In scope (pure-function tests, no Mongo, no Playwright)

```
backend/tests/
├── conftest.py
├── test_adapters.py                # _normalize_greenhouse / _normalize_lever
├── test_matcher_keyword.py         # KeywordMatcher.score across many cases
├── test_dispatcher_decision.py     # decision logic isolated as pure helper
│                                   # _decide(score, caps, thresholds) -> Decision
└── fixtures/
    ├── greenhouse_swiggy.json
    └── lever_flexport.json
```

**Cases that must be tested:**

- **Adapters:** real captured API response → expected `NormalizedJob` shape; missing optional fields default sanely; HTML stripped from description.
- **`KeywordMatcher`:** no overlap → 0; perfect role+keywords+location overlap → 1.0 (clamped); partial overlap → expected weighted sum; case insensitivity; multi-term keywords split correctly.
- **`_decide` helper:** above auto threshold + cap room + platform room → `auto_apply`; above auto but cap exhausted → `notify`; above auto but platform daily limit hit → `notify`; below notify → never returned (filtered earlier).

### 13.2 Deliberately out of scope

- `discovery_service.sync_all` end-to-end — needs Mongo. Manual smoke via admin "Sync now" button (`POST /api/admin/discovery/sync`).
- Playwright bots — selectors change, browser flakes, slow. Manual smoke against 2-3 real Greenhouse/Lever jobs before each release.
- API endpoints — FastAPI's `TestClient` is fine but needs Mongo fixtures the repo doesn't have. Manual via `/docs`.

### 13.3 Tooling delta

- Add `pytest` + `pytest-asyncio` to `backend/requirements.txt`.
- New `pytest.ini` or `pyproject.toml` section: `asyncio_mode = "auto"`.
- Local entry point: `pytest backend/tests/`. No CI exists yet — wire one up in a later slice.

---

## 14. Manual test plan

Run after implementation to validate end-to-end behavior:

1. **Seed companies.** `POST /api/admin/companies/seed` reads from `backend/data/companies.json` (committed; format: `[{"name": "Swiggy", "ats": "greenhouse", "slug": "swiggy"}, ...]`; 10 known-good Greenhouse + 5 Lever slugs at minimum). Seed is idempotent (upserts on `(ats, slug)`). Verify rows appear in `/api/admin/companies`.
2. **Wait for first discovery cycle** (~10 seconds after backend boot in dev). Check `last_synced_at` populated on each Company; `jobs` collection has entries.
3. **Configure a test user.** Set `auto_apply_threshold=0.9`, `notify_threshold=0.6`, `discovery_daily_cap=20`. Enable `greenhouse` platform with keywords matching one of the seeded companies' postings.
4. **Trigger rematch.** `POST /api/discovery/rematch` — verify `job_matches` rows appear in `GET /api/discovery/feed`. Verify decision and score values look sane.
5. **Test the auto-apply path.** Pick a `notify`-decision match, click Apply in the UI → verify Playwright opens a window, fills the form, submits. Verify `Application` row written and `JobMatch.state="applied"`.
6. **Test the cap.** Set `discovery_daily_cap=1`. Force two auto-apply matches — verify the second is downgraded to `notify`.
7. **Test the failure path.** Clear `GlobalSetting.resume_path` for the test user, trigger apply on a match → verify `JobMatch.state="failed"`, log message "no resume uploaded", **no cap consumption**.
8. **Test rematch cooldown.** Call `POST /api/discovery/rematch` twice in quick succession — second should return HTTP 429.

---

## 15. Open questions deferred to later slices

- **Per-user company watchlists.** Currently global admin list. Once users want company-specific tracking, this becomes a join table + per-user polling budget question.
- **Embedding/LLM matcher.** Protocol is in place; swap is one line. Triggered when keyword-overlap quality is observably bad.
- **AI-fill for custom ATS questions.** Skipped in slice 1 — required custom questions cause `state="failed"`. Worth revisiting once a body of real custom questions is observed.
- **Discovery for non-ATS career pages.** Zepto/Meesho/CRED and ~100 hand-picked Indian startups — slice 2.
- **Real-time UI updates for in-flight applies.** Currently only via the WebSocket log stream. A `JobMatch` change stream would be cleaner but is over-engineered for current traffic.
- **CI + DB-integration tests + Playwright bot tests.** All deferred until the codebase has a baseline CI in place.

---

## Sign-off

Approved through round-by-round design review:

- §2 Architecture overview
- §3 Data model
- §4 Discovery service
- §5–§6 Matching + dispatcher
- §7–§10 Bots + scheduler + APIs + frontend
- §11–§14 Error handling, observability, testing, manual test plan

Next step: implementation plan via `superpowers:writing-plans`.
