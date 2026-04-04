import asyncio
import uuid

from fastapi import APIRouter, Depends
from backend.schemas import TriggerRequest, TriggerResponse
from backend.services.bot_runner import run_selected_platforms, run_all_enabled_platforms
from backend.models import User
from backend.auth import get_current_user

router = APIRouter(tags=["trigger"])

_running: dict[int, bool] = {}


@router.get("/run/status")
async def run_status(user: User = Depends(get_current_user)):
    return {"running": _running.get(user.id, False)}


@router.post("/run", response_model=TriggerResponse)
async def trigger_run(
    body: TriggerRequest | None = None,
    user: User = Depends(get_current_user),
):
    if _running.get(user.id, False):
        return TriggerResponse(run_id="", message="A run is already in progress")

    run_id = str(uuid.uuid4())[:8]

    if body and body.platforms:
        asyncio.create_task(_run_selected(body.platforms, run_id, user.id))
    else:
        asyncio.create_task(_run_all(run_id, user.id))

    return TriggerResponse(run_id=run_id, message="Bot run started")


async def _run_all(run_id: str, user_id: int):
    _running[user_id] = True
    try:
        await run_all_enabled_platforms(user_id)
    finally:
        _running[user_id] = False


async def _run_selected(platforms: list[str], run_id: str, user_id: int):
    _running[user_id] = True
    try:
        await run_selected_platforms(platforms, user_id)
    finally:
        _running[user_id] = False
