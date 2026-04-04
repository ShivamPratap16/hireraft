from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.api.auth import router as auth_router
from backend.api.dashboard import router as dashboard_router
from backend.api.settings import router as settings_router
from backend.api.logs import router as logs_router
from backend.api.trigger import router as trigger_router
from backend.api.roles import router as roles_router
from backend.api.profile import router as profile_router
from backend.api.runs import router as runs_router
from backend.api.notifications import router as notifications_router
from backend.config import RESUME_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    from backend.scheduler import start_scheduler
    scheduler = start_scheduler()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(title="HireRaft", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(trigger_router, prefix="/api")
app.include_router(roles_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

app.mount("/resumes", StaticFiles(directory=str(RESUME_DIR)), name="resumes")
