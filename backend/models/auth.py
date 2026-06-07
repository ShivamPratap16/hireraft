"""User identity collections — auth + per-user profile."""

from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field

from backend.models._base import utcnow


class User(Document):
    email: Indexed(str, unique=True)
    hashed_password: str
    name: str = ""
    role: str = "user"
    is_blocked: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"


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
