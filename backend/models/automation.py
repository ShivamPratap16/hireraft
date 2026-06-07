"""Automation-channel collections — the LinkedIn / Indeed / Naukri / Internshala
search-and-apply bot fleet.

PlatformSetting holds per-user credentials + targeting; Application is the
per-user record of "this user applied to this job_url" (globally unique on
job_url); BotRun is the per-run summary the daily 9 AM cron writes.
"""

from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field

from backend.models._base import utcnow


class PlatformSetting(Document):
    user_id: Indexed(str)
    platform: str
    enabled: bool = False
    username: str = ""
    password: str = ""
    daily_limit: int = 25
    keywords: str = ""
    role: str = ""
    location: str = ""
    experience: str = ""

    class Settings:
        name = "platform_settings"


class Application(Document):
    user_id: Indexed(str)
    job_title: str
    company_name: str = ""
    platform: str
    job_url: Indexed(str, unique=True)
    status: str = "applied"
    applied_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    notes: str = ""
    follow_up_date: str = ""

    class Settings:
        name = "applications"


class BotRun(Document):
    run_id: Indexed(str)
    user_id: Indexed(str)
    platform: str
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: Optional[datetime] = None
    status: str = "running"
    jobs_found: int = 0
    jobs_applied: int = 0
    jobs_skipped: int = 0
    error_count: int = 0

    class Settings:
        name = "bot_runs"
