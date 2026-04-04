# HireRaft

Auto-apply to jobs on LinkedIn, Indeed, Naukri, and Internshala with a single resume.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn backend.main:app --reload
```

Run from the project root (`job-pilot/`) so Python resolves the `backend` package:

```bash
cd job-pilot
uvicorn backend.main:app --reload
```

Backend runs on `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` + `/ws` to the backend.

## Features

- Dashboard with filterable application table and status management
- Settings page for per-platform credentials, keywords, location, daily limits
- Resume upload (single resume, used for all platforms)
- Scheduled daily runs via APScheduler (configurable time)
- Manual trigger from the dashboard
- Real-time log viewer via WebSocket
- Deduplication — never applies to the same job twice
- Daily limits per platform
