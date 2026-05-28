import json
from pathlib import Path

import pytest

from backend.services.discovery_service import (
    NormalizedJob,
    _normalize_greenhouse,
    _normalize_lever,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text())


def test_normalize_greenhouse_extracts_required_fields():
    raw_jobs = _load("greenhouse_sample.json")["jobs"]
    out = [_normalize_greenhouse(j) for j in raw_jobs]

    assert len(out) == 2
    first = out[0]
    assert isinstance(first, NormalizedJob)
    assert first.external_id == "4001234"
    assert first.title == "Backend Engineer"
    assert first.location == "Bangalore, India"
    assert first.job_url == "https://boards.greenhouse.io/swiggy/jobs/4001234"
    assert "<p>" not in first.description
    assert "<b>" not in first.description
    assert "&#39;" not in first.description
    assert "backend engineer" in first.description.lower()


def test_normalize_greenhouse_handles_missing_location():
    job = {
        "id": 9999,
        "title": "T",
        "absolute_url": "https://x",
        "content": "<p>hi</p>",
    }
    nj = _normalize_greenhouse(job)
    assert nj.location == ""


def test_normalize_lever_extracts_required_fields():
    raw_jobs = _load("lever_sample.json")
    out = [_normalize_lever(j) for j in raw_jobs]

    assert len(out) == 1
    nj = out[0]
    assert nj.external_id == "abc-123-def"
    assert nj.title == "Senior Backend Engineer"
    assert nj.location == "San Francisco"
    assert nj.job_url == "https://jobs.lever.co/flexport/abc-123-def"
    assert "<p>" not in nj.description
    assert "freight" in nj.description.lower()


def test_normalize_lever_prefers_description_plain_when_present():
    job = {
        "id": "x",
        "text": "T",
        "hostedUrl": "https://x",
        "categories": {},
        "description": "<p>HTML version</p>",
        "descriptionPlain": "plain version",
    }
    assert _normalize_lever(job).description == "plain version"
