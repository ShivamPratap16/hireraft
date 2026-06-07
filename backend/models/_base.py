"""Shared helpers used by the per-domain model modules.

Keeping this here (rather than in __init__.py) avoids a circular-import
trap: every domain module imports `utcnow` from this file, and __init__
re-exports from every domain module.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Single source of truth for `now` across model defaults."""
    return datetime.now(timezone.utc)
