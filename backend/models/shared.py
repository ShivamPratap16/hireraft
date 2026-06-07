"""Cross-cutting per-user collections used by both channels.

GlobalSetting is the per-user (despite the name) preferences bucket —
schedule, resume path, and the discovery thresholds. RunLog is the unified
log stream for all bot/discovery activity; it powers both the user-facing
Logs page and the WebSocket live tail. Notification is the user's inbox.
"""

from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field

from backend.models._base import utcnow


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
    last_rematch_at: Optional[datetime] = None

    class Settings:
        name = "global_settings"


class RunLog(Document):
    # None for system-level logs (e.g. discovery_cycle).
    user_id: Optional[str] = None
    run_id: str
    platform: str = ""
    level: str = "info"
    message: str = ""
    timestamp: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "run_logs"
        indexes = ["user_id"]


class Notification(Document):
    user_id: Indexed(str)
    type: str = "info"
    title: str = ""
    message: str = ""
    is_read: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "notifications"
