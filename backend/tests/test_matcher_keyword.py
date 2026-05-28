from types import SimpleNamespace

import pytest

from backend.services.matching_service import KeywordMatcher


def _make_job(title="", description="", location=""):
    return SimpleNamespace(title=title, description=description, location=location)


def _make_settings(role="", keywords="", location=""):
    return SimpleNamespace(role=role, keywords=keywords, location=location)


@pytest.fixture
def matcher():
    return KeywordMatcher()


async def test_no_overlap_yields_zero(matcher):
    job = _make_job(title="Lorem ipsum", description="dolor sit amet")
    settings = _make_settings(role="React engineer", keywords="typescript")
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    assert score == 0.0
    assert matched == []


async def test_full_overlap_clamps_to_one(matcher):
    job = _make_job(
        title="Backend engineer",
        description="Python FastAPI microservices",
        location="Bangalore",
    )
    settings = _make_settings(
        role="backend engineer",
        keywords="python, fastapi, microservices",
        location="Bangalore",
    )
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    assert score == pytest.approx(1.0, abs=1e-6)
    assert "backend" in matched
    assert "python" in matched
    assert "Bangalore" in matched


async def test_location_only_adds_location_weight(matcher):
    job = _make_job(title="Lorem", description="ipsum", location="Bangalore")
    settings = _make_settings(role="", keywords="", location="Bangalore")
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    assert score == pytest.approx(0.2)
    assert matched == ["Bangalore"]


async def test_partial_keyword_overlap(matcher):
    job = _make_job(
        title="Backend Engineer",
        description="We need Python skills",
    )
    settings = _make_settings(
        role="backend engineer",
        keywords="python, fastapi",
    )
    score, matched = await matcher.score(user=None, settings=settings, job=job)
    # role: both terms match → 0.4
    # keywords: 1 of 2 matches → 0.2
    # total = 0.6
    assert score == pytest.approx(0.6, abs=1e-6)
    assert "python" in matched


async def test_case_insensitive(matcher):
    job = _make_job(title="REACT DEVELOPER", description="")
    settings = _make_settings(role="react developer")
    score, _ = await matcher.score(user=None, settings=settings, job=job)
    assert score > 0


async def test_score_never_exceeds_one(matcher):
    job = _make_job(
        title="python python python",
        description="python python",
        location="Bangalore",
    )
    settings = _make_settings(
        role="python",
        keywords="python",
        location="Bangalore",
    )
    score, _ = await matcher.score(user=None, settings=settings, job=job)
    assert 0.0 <= score <= 1.0
