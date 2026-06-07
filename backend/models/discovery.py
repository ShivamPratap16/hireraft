"""Discovery-channel collections — the curated ATS-API world.

Company is the admin-curated list of which slugs to poll on which ATS. Job
is the global record of every active posting we've ever seen, deduped on
external_id ("ats:slug:posting_id"). JobMatch is the per-user actionable
match (only persisted at or above the user's notify_threshold).
"""

from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field
from pymongo import IndexModel

from backend.models._base import utcnow


class Company(Document):
    name: str
    ats: str                                  # "greenhouse" | "lever" | ...
    slug: Indexed(str)
    active: bool = True
    last_synced_at: Optional[datetime] = None
    last_sync_error: str = ""
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "companies"
        indexes = [
            IndexModel([("ats", 1), ("slug", 1)], unique=True),
        ]


class Job(Document):
    external_id: Indexed(str, unique=True)     # "greenhouse:swiggy:4001234"
    ats: str
    company_slug: str
    company_name: str
    title: str
    description: str = ""
    description_hash: str = ""
    location: str = ""
    job_url: str
    status: str = "active"                     # "active" | "closed"
    first_seen_at: datetime = Field(default_factory=utcnow)
    last_seen_at: datetime = Field(default_factory=utcnow)
    closed_at: Optional[datetime] = None
    raw: dict = Field(default_factory=dict)

    class Settings:
        name = "jobs"
        indexes = [
            "status",
            "ats",
            [("company_slug", 1), ("status", 1)],
        ]


class JobMatch(Document):
    user_id: Indexed(str)
    job_id: str
    score: float
    matched_terms: list[str] = []
    decision: str                              # "auto_apply" | "notify"
    state: str = "pending"                     # pending | applied | failed | dismissed
    created_at: datetime = Field(default_factory=utcnow)
    applied_at: Optional[datetime] = None

    class Settings:
        name = "job_matches"
        indexes = [
            IndexModel([("user_id", 1), ("job_id", 1)], unique=True),
            "state",
        ]
