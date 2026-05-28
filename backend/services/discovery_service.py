"""ATS discovery service — slice 1 (Greenhouse + Lever)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html import unescape


@dataclass
class NormalizedJob:
    """ATS-agnostic representation of a posting."""
    external_id: str
    title: str
    description: str       # plain text, HTML stripped
    location: str
    job_url: str
    raw: dict = field(default_factory=dict)


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(text: str) -> str:
    if not text:
        return ""
    no_tags = _HTML_TAG_RE.sub(" ", text)
    decoded = unescape(no_tags)
    return _WHITESPACE_RE.sub(" ", decoded).strip()


def _normalize_greenhouse(job: dict) -> NormalizedJob:
    loc = job.get("location") or {}
    return NormalizedJob(
        external_id=str(job["id"]),
        title=job.get("title", "").strip(),
        description=_strip_html(job.get("content", "")),
        location=(loc.get("name") or "").strip() if isinstance(loc, dict) else str(loc),
        job_url=job.get("absolute_url", ""),
        raw=job,
    )


def _normalize_lever(job: dict) -> NormalizedJob:
    cats = job.get("categories") or {}
    desc = job.get("descriptionPlain") or _strip_html(job.get("description", ""))
    return NormalizedJob(
        external_id=str(job["id"]),
        title=job.get("text", "").strip(),
        description=desc.strip(),
        location=(cats.get("location") or "").strip(),
        job_url=job.get("hostedUrl", ""),
        raw=job,
    )
