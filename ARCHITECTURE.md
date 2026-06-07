# Architecture

Engineer reference for working in this codebase — required env vars, the layered structure, the two-channel design decision, the data model, and the non-obvious gotchas worth knowing before you touch the code.

## What this is

HireRaft is an auto-apply bot that surfaces jobs through **two intentionally separate channels** and submits a single resume on the user's behalf. It is a two-process app: a FastAPI backend that drives Playwright bots, and a React/Vite frontend dashboard.

### The two channels (architectural decision — don't conflate them)

| Channel | Source | What it's good for | Code lives in |
|---|---|---|---|
| **Automation** (volume) | LinkedIn, Indeed, Naukri, Internshala — search-and-apply via Playwright with the user's own credentials | High volume across millions of jobs; tens of thousands of companies | `backend/bots/{linkedin,indeed,naukri,internshala}.py` |
| **Discovery** (high-signal, curated) | Greenhouse, Lever, Ashby, Workable, SmartRecruiters — public ATS APIs polled from an admin-curated company list | Curated India-focused startup boards where the apply form is fillable and submission actually works; no user credentials | `backend/services/discovery_service.py` + `backend/bots/{ats_base,greenhouse,lever}.py` |

The channels are parallel, not competing. **Don't try to make Discovery the volume channel** — the realistic options (Workday/iCIMS adapters, paid aggregator APIs, LinkedIn-style scraping in Discovery) were explicitly considered and rejected: duplicating volume in Discovery competes with the existing bots without adding signal. Greenhouse + Lever + Ashby + Workable + SR combined globally is ~24k customers; the India-focused subset is realistically a few hundred. Discovery's job is *quality*: better matching, better company curation, better apply UX. Volume questions belong to the automation bot fleet.

## Common commands

All backend commands must be run **from the repository root** (not from `backend/`) so Python resolves the `backend` package.

### Backend (FastAPI + Playwright + MongoDB)
```bash
# First-time setup
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
playwright install chromium

# Run dev server (must be from repo root, NOT from backend/)
uvicorn backend.main:app --reload
# API docs: http://localhost:8000/docs
```

Requires MongoDB running locally (default `mongodb://localhost:27017/jobpilot`) — override via `MONGODB_URI` env var.

### Frontend (React 19 + Vite + Tailwind v4)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 — proxies /api + /ws to :8000
npm run build    # tsc -b && vite build
npm run lint     # eslint .
```

### Admin user
```bash
python create_admin.py   # creates/elevates admin@hireraft.com / admin
```

### Tests
No test suite exists yet (no `pytest`, no `vitest`/`jest` config). Don't claim test coverage in PRs.

## Required env vars

Set in `.env` at repo root (loaded by `backend/config.py`):

- `MONGODB_URI` — Mongo connection string (default: `mongodb://localhost:27017/jobpilot`)
- `ENCRYPTION_KEY` — **Fernet key** used to encrypt platform passwords in DB. If missing or set to the placeholder `change-me-to-a-real-fernet-key`, a fresh key is generated **per process start** — meaning any previously stored platform passwords become undecryptable. Set this to a stable value in any non-throwaway environment.
- `JWT_SECRET` — HS256 signing key for auth tokens (default `jobpilot-local-secret-change-in-prod`; 30-day expiry).
- `LIGHTCAST_CLIENT_ID` / `LIGHTCAST_CLIENT_SECRET` — optional, for job-title autocomplete.

## Architecture

### Request flow

```
Browser  ──/api──>  FastAPI (backend/main.py)  ──>  Beanie/Motor  ──>  MongoDB
   │                       │
   └──/ws/logs─────────────┴──> log_service broadcasts to all sockets
```

`backend/main.py` mounts ten routers under `/api`: `auth`, `dashboard`, `settings`, `logs`, `trigger`, `roles`, `profile`, `runs`, `notifications`, `admin`. It also mounts `/resumes/` as a static directory serving `data/resumes/`.

### Bot execution model

The interesting code lives in `backend/bots/base.py`. `BaseBot` is an ABC that defines the full Playwright lifecycle once; per-platform subclasses (`naukri.py`, `internshala.py`, `indeed.py`, `linkedin.py`) only override three abstract methods:

```python
async def login(self, page): ...
async def search_jobs(self, page) -> list[dict]: ...
async def apply_to_job(self, page, job: dict) -> bool: ...
```

`BaseBot._execute_run_once` handles all the cross-cutting concerns — **do not duplicate these in subclasses**:
- Launches Chromium headed (`headless=False`) with `--disable-blink-features=AutomationControlled`.
- Persists browser session state per `(user_id, platform)` at `data/browser_sessions/u{user_id}_{platform}.json` and reuses it on next run.
- Pauses up to 3 min if the URL contains `captcha`/`checkpoint`/`challenge`/`verify` so the user can solve it.
- Enforces three skip conditions before applying: daily limit reached, already applied to this exact `job_url`, or same `(job_title, company_name)` already applied on another platform.
- Random 2–5 s delays via `_random_delay()` between operations.
- Wraps the whole thing in **one retry** — on first failure, the session file is deleted and the bot tries again with a fresh login.

`backend/services/bot_runner.py` is the orchestrator. `run_platform()` loads `PlatformSetting` for `(user_id, platform)`, decrypts the password via `config.decrypt()`, instantiates the bot from `BOT_MAP`, calls `bot.run()`, then writes a `BotRun` summary record and a notification.

### Data model (MongoDB via Beanie)

All collections are registered in `backend/database.py:init_db`. Every per-user document carries an indexed `user_id: str` (string form of the User's ObjectId). The unique indexes worth knowing:
- `User.email` — unique
- `Application.job_url` — unique **globally** (not per-user), so a job URL can only ever exist once across all users
- `Profile.user_id` — unique (one profile per user)

`PlatformSetting.password` is stored as a Fernet ciphertext (encrypted on write via `config.encrypt()`, decrypted in `bot_runner.run_platform()`).

### Auth

JWT bearer tokens, 30-day expiry. `backend/auth.py:get_current_user` is a FastAPI dependency that every protected route uses. Token `sub` is the User's MongoDB ObjectId as a string. `is_blocked=True` users get 403.

Frontend stores the token in `localStorage` as `jp_token` (see `frontend/src/lib/api.ts`). Any 401 from the API auto-clears the token and redirects to `/login`.

### Trigger / run-in-progress tracking

`backend/api/trigger.py` keeps an **in-memory** `_running: dict[user_id, bool]`. This means:
- Run state is lost on backend restart.
- A user can't have two concurrent runs (a second `POST /run` returns "A run is already in progress").
- The frontend polls `/api/run/status` every 5 seconds (`App.tsx`) to drive the "Bot is running…" sidebar indicator.

### Frontend layout

`frontend/src/App.tsx` is the router root. Three route groups:
- **Public:** `/`, `/login`, `/register`, `/privacy`, `/terms` (Landing/Privacy/Terms live under `pages/marketing/`)
- **User (ProtectedLayout):** `/dashboard`, `/profile`, `/automation` (= Settings page), `/logs` — requires `isAuthenticated`, otherwise redirects to `/login`
- **Admin:** `/admin/dashboard`, `/users`, `/activity`, `/analytics` — gated by `user.role === 'admin'`

State management is TanStack Query throughout (no Redux). The single API client lives in `frontend/src/lib/api.ts`.

Vite proxies `/api` to `http://localhost:8000` and `/ws` to `ws://localhost:8000` (WebSocket for the live log viewer) — see `frontend/vite.config.ts`.

## Conventions

- Backend uses Beanie (`Document` subclasses with a nested `class Settings: name = "..."` for the collection name) — not SQLAlchemy. If you see SQLAlchemy imports anywhere except `scheduler.py`, it's leftover and should be ported.
- Platform credentials must always be encrypted before save and decrypted only at bot-launch time. Never log or return decrypted passwords through the API.
- New bot platforms: add a subclass of `BaseBot` in `backend/bots/`, register it in `BOT_MAP` in `bot_runner.py`. Implement only `login`/`search_jobs`/`apply_to_job` — do not reimplement dedup, daily limits, captcha handling, or session persistence; they're in the base class.
