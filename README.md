# HireRaft

Auto-apply engine for job seekers. Search-and-apply across LinkedIn, Indeed, Naukri, and Internshala using your own credentials; plus a curated **Discovery** channel that polls public Greenhouse / Lever / Ashby / Workable / SmartRecruiters boards and surfaces high-confidence matches.

A small, opinionated codebase — FastAPI + Beanie (MongoDB) + Playwright on the backend, React 19 + TypeScript + TanStack Query on the frontend. Async throughout, single venv, no microservices.

---

## Two channels, one product

The interesting design choice. Most "auto-apply" tools pick one of these and stretch it to do both jobs badly. HireRaft separates them on purpose.

| Channel | Source | Strength | Code |
|---|---|---|---|
| **Automation** | LinkedIn, Indeed, Naukri, Internshala — Playwright bots driving the user's logged-in session | Volume — tens of thousands of companies, millions of jobs | `backend/bots/{linkedin,indeed,naukri,internshala}.py` |
| **Discovery** | Greenhouse, Lever, Ashby, Workable, SmartRecruiters — public ATS APIs polled from an admin-curated company list | Signal — fillable forms, no captcha, auto-apply actually works | `backend/services/discovery_service.py` + `backend/bots/{ats_base,greenhouse,lever}.py` |

The boundary is enforced at the data model (`PlatformSetting.platform`) and at runtime: automation bots subclass `BaseBot` (login → search → loop); discovery bots subclass `AtsApplyBot` (no login, one job per invocation). Two bases because the runtimes genuinely have different shapes — force-fitting one would have meant fake `login()` stubs and one-element `search_jobs()` lists.

---

## Architecture

```
                            ┌──────────────────────────┐
                            │   React + TS + Vite      │
                            │   (TanStack Query, R19)  │
                            └────────────┬─────────────┘
                                         │ /api/*  + WebSocket /ws/*
                                         ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │                       FastAPI  (backend/main.py)                  │
   │                                                                   │
   │   /api/auth/*   /api/settings/*   /api/applications/*             │
   │   /api/discovery/*   /api/admin/*   /api/logs/*                   │
   └──────────────────┬────────────────────────┬───────────────────────┘
                      │                        │
            ┌─────────▼─────────┐    ┌─────────▼──────────┐
            │  backend/services │    │  backend/scheduler │
            │  ─────────────    │    │  ────────────────  │
            │  discovery_       │    │  daily 9am   ──►   │  bots.run()
            │   service         │    │  hourly cycle ──►  │  discovery
            │  matching_service │    │                    │
            │  match_dispatcher │    └────────────────────┘
            │  bot_runner       │
            └─────────┬─────────┘
                      │
                      ▼
            ┌────────────────────┐         ┌─────────────────────┐
            │ Beanie / Motor →   │         │ Playwright headless │
            │ MongoDB            │         │ Chromium per run    │
            │                    │         └─────────────────────┘
            │ Users · Profiles   │
            │ Applications       │
            │ Companies · Jobs   │
            │ JobMatches         │
            └────────────────────┘
```

The hourly **discovery cycle** is a single three-line orchestrator:

```python
stats     = await discovery_service.sync_all()              # poll ATS APIs in parallel
matches   = await matching_service.score_jobs(stats.new_job_ids + stats.changed_job_ids)
await match_dispatcher.dispatch(matches)                    # → auto-apply or notify
```

Everything inside `dispatch()` is sequential within a single asyncio task — no queue, no event bus, deliberately not yet. Adding one is a future-slice problem, not an MVP problem.

---

## What's worth a second look

A few places where the code does something a little more interesting than the average CRUD app:

- **`backend/services/match_dispatcher.py:_decide`** — the auto-apply vs notify decision is extracted as a pure function with 5 unit tests. The I/O layer wraps it. This is the only way the code stays testable without a Mongo fixture.
- **`backend/services/matching_service.py:Matcher`** — a `Protocol` boundary, so today's `KeywordMatcher` can be swapped for an embedding-based or LLM-based scorer in one line, with no DB migration.
- **`backend/services/discovery_service.py:sync_all`** — `asyncio.gather(*tasks, return_exceptions=True)`. One company's adapter raising must not kill its siblings. This single keyword argument is the most important line in the file.
- **`backend/services/match_dispatcher.py:_dispatch_for_user`** — sorts candidates by score descending *before* consuming the daily cap, so a user's best matches auto-apply rather than the first N returned by Mongo. Cap-exhausted matches downgrade to a `notify` `JobMatch` (visible in feed) rather than being silently dropped.
- **`scripts/discover_companies.py`** — slug-probe discovery has a 48% false-positive rate (slug `pulse` matches a different "Pulse" company's 2,480-job board). Mitigated by an India-location filter on the probe response: hits keep only when ≥50% of the board's jobs are in Indian cities. Dropped Pulse, Slice, Loop, Karbon from the seed without dropping Paytm, PhonePe, Unacademy.
- **Test discipline** — `backend/tests/` covers adapters, the matcher, and the dispatcher decision pure-function. 15 tests, all under `pytest -q backend/tests`. No DB integration tests yet by design; they require fixture infra not worth building until the codebase has enough complexity to need them.

---

## Project layout

```
backend/
├── api/                        FastAPI routers — one per resource
│   ├── auth.py                 register/login (seeds 9 PlatformSettings per user)
│   ├── discovery.py            user-facing feed, apply, dismiss, rematch
│   ├── admin.py                companies CRUD, jobs (read-only), observability tiles
│   ├── settings.py             per-platform credentials + global thresholds
│   └── ...                     dashboard, logs, runs, notifications, profile, trigger
├── bots/
│   ├── base.py                 BaseBot — search-and-apply lifecycle (login → search → loop)
│   ├── ats_base.py             AtsApplyBot — single-job, no-login form-fill
│   ├── {linkedin,indeed,naukri,internshala}.py    automation bots (search-driven)
│   ├── {greenhouse,lever}.py   discovery bots (single-job, public forms)
│   └── _constants.py           shared USER_AGENT
├── services/
│   ├── discovery_service.py    poll ATS APIs in parallel + upsert Jobs + stale-sweep
│   ├── matching_service.py     score Job × User pairs (swappable Matcher Protocol)
│   ├── match_dispatcher.py     auto_apply vs notify; daily cap; idempotency
│   ├── bot_runner.py           dispatch by platform
│   └── application_service.py, log_service.py, notification_service.py, ...
├── tests/                      pytest + pytest-asyncio; pure-function only
└── data/companies.json         curated Indian-startup seed list

scripts/
└── discover_companies.py       slug-probe YC + curated list against 5 ATS APIs

docs/superpowers/
├── specs/2026-05-28-ats-discovery-engine-slice1-design.md      design doc
└── plans/2026-05-28-ats-discovery-engine-slice1.md             24-task implementation plan
```

---

## Tech stack

- **Backend** — Python 3.14, FastAPI, Beanie (Motor/MongoDB), Playwright, APScheduler, httpx, bcrypt + PyJWT, Fernet for credential encryption at rest
- **Frontend** — React 19, TypeScript, Vite, TanStack Query, Tailwind v4, React Router 7, date-fns, lucide-react
- **Tests** — pytest + pytest-asyncio (backend pure-function tests); ESLint + tsc for frontend
- **Async** — `asyncio` end-to-end; `asyncio.gather(..., return_exceptions=True)` for parallel sibling tasks; semaphore-limited concurrency in the discovery script

---

## Running locally

```bash
# MongoDB
brew services start mongodb-community

# Backend
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
playwright install chromium
# Required env vars: MONGODB_URI, ENCRYPTION_KEY (Fernet), JWT_SECRET
uvicorn backend.main:app --reload                       # http://localhost:8000

# Frontend
cd frontend && npm install && npm run dev               # http://localhost:5173

# Tests
pytest backend/tests/ -v
```

See `CLAUDE.md` for full engineer-level walkthrough — required env vars, gotchas, and architecture notes.

---

## Status

Slice 1 (Discovery engine) is implemented and verified end-to-end. The hourly cycle has ingested ~1,500 real jobs from 12 verified Indian companies across Greenhouse / Lever / SmartRecruiters. Auto-apply works for Greenhouse and Lever; Ashby / Workable / SmartRecruiters land in the user's feed as notifications until those apply-bots are built.

```
✔  Curated company list (admin CRUD, JSON seed, slug-probe discovery script)
✔  Hourly discovery cycle  (sync_all → matching → dispatch)
✔  Auto-apply: Greenhouse + Lever via Playwright
✔  India-only filter on admin Jobs view
✔  Per-user thresholds + daily cap with downgrade-to-notify
✔  Spec-first workflow with design + plan docs committed
○  Apply bots for Ashby / Workable / SmartRecruiters  (notify-only today)
○  Embedding/LLM matcher  (Protocol boundary already in place)
○  CI + integration tests  (intentional — adding when the surface stabilises)
```

---

## Decision records

This isn't a tutorial; it's a record. The design and implementation discussions live under `docs/superpowers/`:

- `specs/2026-05-28-ats-discovery-engine-slice1-design.md` — the spec the slice was built from (data model, error matrix, manual test plan)
- `plans/2026-05-28-ats-discovery-engine-slice1.md` — the 24-task TDD implementation plan executed to ship slice 1

The `CLAUDE.md` file at the repo root is the always-loaded engineer brief for anyone working in the codebase — including the two-channel architectural decision that wasn't documented in slice 1's spec.
