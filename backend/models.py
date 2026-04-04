from datetime import datetime, timezone
from beanie import Document, Indexed
from pydantic import Field
from typing import Optional

def utcnow():
    return datetime.now(timezone.utc)

class User(Document):
    email: Indexed(str, unique=True)
    hashed_password: str
    name: str = ""
    role: str = "user"
    is_blocked: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"

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

class RunLog(Document):
    user_id: Indexed(str)
    run_id: str
    platform: str = ""
    level: str = "info"
    message: str = ""
    timestamp: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "run_logs"

class GlobalSetting(Document):
    user_id: Indexed(str)
    resume_path: str = ""
    schedule_time: str = "09:00"
    schedule_enabled: bool = True

    class Settings:
        name = "global_settings"

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

class Notification(Document):
    user_id: Indexed(str)
    type: str = "info"
    title: str = ""
    message: str = ""
    is_read: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "notifications"

class Profile(Document):
    user_id: Indexed(str, unique=True)
    full_name: str = ""
    headline: str = ""
    phone: str = ""
    location: str = ""
    date_of_birth: str = ""
    gender: str = ""

    summary: str = ""
    skills: str = ""
    languages: str = ""

    education: str = ""
    experience: str = ""

    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    other_url: str = ""

    preferred_salary: str = ""
    notice_period: str = ""
    job_type: str = ""
    work_mode: str = ""

    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "profiles"
