from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Platform Settings ──

class PlatformSettingRead(BaseModel):
    id: str
    platform: str
    enabled: bool
    username: str
    password: str
    daily_limit: int
    keywords: str
    role: str
    location: str
    experience: str

    model_config = {"from_attributes": True}


class PlatformSettingUpdate(BaseModel):
    enabled: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    daily_limit: Optional[int] = None
    keywords: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    experience: Optional[str] = None


# ── Applications ──

class ApplicationRead(BaseModel):
    id: str
    job_title: str
    company_name: str
    platform: str
    job_url: str
    status: str
    applied_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    notes: str = ""
    follow_up_date: str = ""
    other_platforms: list[str] = []

    model_config = {"from_attributes": True}


class ApplicationStatusUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


class ApplicationFilter(BaseModel):
    platform: Optional[str] = None
    status: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    page: int = 1
    page_size: int = 20


# ── Global Settings ──

class GlobalSettingRead(BaseModel):
    id: str
    resume_path: str
    schedule_time: str
    schedule_enabled: bool

    model_config = {"from_attributes": True}


class GlobalSettingUpdate(BaseModel):
    schedule_time: Optional[str] = None
    schedule_enabled: Optional[bool] = None


# ── Logs ──

class RunLogRead(BaseModel):
    id: str
    run_id: str
    platform: str
    level: str
    message: str
    timestamp: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BotRunRead(BaseModel):
    id: str
    run_id: str
    platform: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    status: str
    jobs_found: int
    jobs_applied: int
    jobs_skipped: int
    error_count: int

    model_config = {"from_attributes": True}


class RunDetailResponse(BaseModel):
    run_id: str
    platforms: list[BotRunRead]
    logs: list[RunLogRead]


# ── Trigger ──

class TriggerRequest(BaseModel):
    platforms: Optional[list[str]] = None


class TriggerResponse(BaseModel):
    run_id: str
    message: str


# ── Profile ──

class ProfileRead(BaseModel):
    id: str
    full_name: str
    headline: str
    phone: str
    location: str
    date_of_birth: str
    gender: str
    summary: str
    skills: str
    languages: str
    education: str
    experience: str
    linkedin_url: str
    github_url: str
    portfolio_url: str
    other_url: str
    preferred_salary: str
    notice_period: str
    job_type: str
    work_mode: str

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[str] = None
    languages: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    other_url: Optional[str] = None
    preferred_salary: Optional[str] = None
    notice_period: Optional[str] = None
    job_type: Optional[str] = None
    work_mode: Optional[str] = None
