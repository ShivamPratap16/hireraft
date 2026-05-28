"""Matching service — slice 1 (keyword overlap)."""

from __future__ import annotations

import re
from typing import Protocol


class Matcher(Protocol):
    async def score(self, user, settings, job) -> tuple[float, list[str]]:
        """Returns (score in [0, 1], explanation_terms)."""
        ...


_SPLIT_RE = re.compile(r"[,\s]+")


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [t.lower() for t in _SPLIT_RE.split(text.strip()) if t]


class KeywordMatcher:
    """Weighted overlap of user role/keywords/location against job text."""

    WEIGHTS = {"role": 0.4, "keywords": 0.4, "location": 0.2}

    async def score(self, user, settings, job) -> tuple[float, list[str]]:
        haystack = f"{job.title} {job.description} {job.location}".lower()
        matched: list[str] = []
        score = 0.0

        role_terms = _tokenize(settings.role)
        if role_terms:
            per_term = self.WEIGHTS["role"] / len(role_terms)
            for term in role_terms:
                if term in haystack:
                    score += per_term
                    matched.append(term)

        kw_terms = _tokenize(settings.keywords)
        if kw_terms:
            per_term = self.WEIGHTS["keywords"] / len(kw_terms)
            for term in kw_terms:
                if term in haystack:
                    score += per_term
                    matched.append(term)

        if settings.location and settings.location.lower() in haystack:
            score += self.WEIGHTS["location"]
            matched.append(settings.location)

        return min(score, 1.0), matched
