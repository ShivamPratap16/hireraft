"""HireRaft Beanie document models, split by domain.

Existing ``from backend.models import X`` imports continue to work — the
documents are defined in the per-domain submodules and re-exported here.

- :mod:`backend.models.auth`        — User, Profile
- :mod:`backend.models.automation`  — PlatformSetting, Application, BotRun
- :mod:`backend.models.shared`      — GlobalSetting, RunLog, Notification
- :mod:`backend.models.discovery`   — Company, Job, JobMatch
"""

from backend.models._base import utcnow
from backend.models.auth import Profile, User
from backend.models.automation import Application, BotRun, PlatformSetting
from backend.models.discovery import Company, Job, JobMatch
from backend.models.shared import GlobalSetting, Notification, RunLog

__all__ = [
    "utcnow",
    "User", "Profile",
    "PlatformSetting", "Application", "BotRun",
    "GlobalSetting", "RunLog", "Notification",
    "Company", "Job", "JobMatch",
]
