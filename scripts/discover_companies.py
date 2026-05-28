"""Discover Indian companies on Greenhouse/Lever ATS.

Pulls candidate names from the YC company mirror (filtered to India) plus a
hand-curated startup list, generates slug variants for each, probes both
ATS APIs concurrently, and writes verified hits to
``backend/data/companies.json``.

Run from the repo root with the project venv active::

    ./venv/bin/python scripts/discover_companies.py

Single file, asyncio + httpx only.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Optional

import httpx


# ─── Config ───────────────────────────────────────────────────────────────

YC_MIRROR_URL = "https://yc-oss.github.io/api/companies/all.json"

GREENHOUSE_URL_TMPL = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
LEVER_URL_TMPL = "https://api.lever.co/v0/postings/{slug}"

CONCURRENCY = 20
PROBE_TIMEOUT = 5.0
YC_FETCH_TIMEOUT = 30.0

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent / "backend" / "data" / "companies.json"
)

# Trailing tokens to strip when generating a slug variant (lowercase).
SUFFIX_STRIP = (
    "technologies",
    "tech",
    "india",
    "hq",
    "company",
    "labs",
    "software",
    "inc",
    "corp",
    "corporation",
    "ltd",
    "limited",
    "rooms",
    "club",
)


INDIAN_STARTUPS = [
    "Swiggy", "Zomato", "Razorpay", "CRED", "Meesho",
    "Zepto", "PhonePe", "Paytm", "Flipkart", "Ola",
    "Dunzo", "Urban Company", "Groww", "Zerodha", "Upstox",
    "BrowserStack", "Postman", "Freshworks", "Chargebee",
    "Zoho", "Cleartax", "Khatabook", "Smallcase", "Licious",
    "Ninjacart", "Zetwerk", "Darwinbox", "Leadsquared",
    "Unacademy", "Vedantu", "Scaler", "Internshala", "Apna",
    "Springworks", "Multiplier", "Hasura", "Decentro", "Setu",
    "Cashfree", "Juspay", "Slice", "Fi Money", "Niyo",
    "Druva", "Icertis", "Innovaccer",
    "Kapture CX", "Keka", "Kissflow", "Leapfinance",
    "Moengage", "Netcore", "Niki", "Observe.AI",
    "Oyo", "Paperflite", "Perfios", "Pubmatic",
    "Quantiphi", "Redbus", "Rupifi", "Saavn",
    "Sharechat", "Shiprocket", "Signzy", "Simplilearn",
    "Spinny", "Sprinklr", "Talview", "Tractable",
    "Truecaller", "Udaan", "Vyapar", "Whatfix",
    "Yellow.ai", "Yulu",
]


# ─── Slug generation ──────────────────────────────────────────────────────

_NORM_RE = re.compile(r"[\s.\-,'’&/]+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]")


def _normalize(text: str) -> str:
    """Lowercase + strip whitespace/punctuation that we don't want in a slug."""
    return _NON_ALNUM_RE.sub("", _NORM_RE.sub("", text).lower())


def slug_candidates(name: str) -> list[str]:
    """Return de-duplicated slug candidates for a company name.

    Variants generated, in order of preference:
      1. base — lowercase, all separators stripped
      2. no_suffix — base minus a trailing common suffix word
      3. base + "hq"
      4. base + "india"
      5. first_word — first whitespace-separated token, normalized
    """
    base = _normalize(name)
    if not base:
        return []

    candidates: list[str] = [base]

    # Trailing suffix strip (only if it leaves something meaningful).
    no_suffix = base
    for s in SUFFIX_STRIP:
        if no_suffix.endswith(s) and len(no_suffix) > len(s) + 1:
            no_suffix = no_suffix[: -len(s)]
            break
    if no_suffix != base:
        candidates.append(no_suffix)

    candidates.append(base + "hq")
    candidates.append(base + "india")

    first_token = name.split()[0] if name.split() else ""
    first_word = _normalize(first_token)
    if first_word:
        candidates.append(first_word)

    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


# ─── YC mirror fetch ──────────────────────────────────────────────────────

def _is_indian(company: dict) -> bool:
    """Robust check across the field-name variants the mirror may use."""
    regions = company.get("regions") or []
    if isinstance(regions, list) and "India" in regions:
        return True
    country = company.get("country") or ""
    if country in ("India", "IN"):
        return True
    countries = company.get("countries") or []
    if isinstance(countries, list) and any(c in ("India", "IN") for c in countries):
        return True
    return False


async def fetch_yc_indian_names(client: httpx.AsyncClient) -> list[str]:
    try:
        r = await client.get(YC_MIRROR_URL, timeout=YC_FETCH_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  ⚠ YC mirror fetch failed: {e!r}", flush=True)
        return []

    if not isinstance(data, list):
        print(f"  ⚠ YC mirror returned non-list payload (got {type(data).__name__})", flush=True)
        return []

    names: list[str] = []
    for c in data:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        if name and _is_indian(c):
            names.append(name)
    return names


# ─── ATS probes ───────────────────────────────────────────────────────────

async def _probe_greenhouse(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[int]:
    """Returns count of live jobs if board exists with at least one job, else None."""
    async with sem:
        try:
            r = await client.get(
                GREENHOUSE_URL_TMPL.format(slug=slug), timeout=PROBE_TIMEOUT
            )
        except Exception:
            return None
    if r.status_code != 200:
        return None
    try:
        jobs = r.json().get("jobs") or []
    except Exception:
        return None
    return len(jobs) if jobs else None


async def _probe_lever(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[int]:
    """Returns count of postings if Lever board has at least one, else None."""
    async with sem:
        try:
            r = await client.get(
                LEVER_URL_TMPL.format(slug=slug), timeout=PROBE_TIMEOUT
            )
        except Exception:
            return None
    if r.status_code != 200:
        return None
    try:
        postings = r.json()
    except Exception:
        return None
    if not isinstance(postings, list) or not postings:
        return None
    return len(postings)


async def find_company_ats(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    name: str,
) -> tuple[str, Optional[dict]]:
    """Try slug variants until one hits Greenhouse or Lever. First hit wins."""
    try:
        for slug in slug_candidates(name):
            gh, lv = await asyncio.gather(
                _probe_greenhouse(client, sem, slug),
                _probe_lever(client, sem, slug),
                return_exceptions=False,
            )
            if gh:
                return name, {"name": name, "ats": "greenhouse", "slug": slug, "live_jobs": gh}
            if lv:
                return name, {"name": name, "ats": "lever", "slug": slug, "live_jobs": lv}
    except Exception:
        # One company crashing must not affect others.
        pass
    return name, None


# ─── Main flow ────────────────────────────────────────────────────────────

def _dedupe_preserving_order(names: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for n in names:
        key = n.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(n.strip())
    return out


async def main() -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient() as client:
        print("Fetching from YC mirror...", end=" ", flush=True)
        yc_names = await fetch_yc_indian_names(client)
        print(f"{len(yc_names)} companies")

        yc_keys = {n.lower() for n in yc_names}
        new_curated = [n for n in INDIAN_STARTUPS if n.lower() not in yc_keys]
        print(f"Adding hand-curated list...       +{len(new_curated)} new names")

        candidates = _dedupe_preserving_order(yc_names + INDIAN_STARTUPS)
        print(f"Total candidates:                 {len(candidates)} companies\n")

        if not candidates:
            print("No candidates to probe — exiting.")
            return 1

        print("Probing ATS APIs...")
        tasks = [
            asyncio.create_task(find_company_ats(client, sem, name))
            for name in candidates
        ]

        hits: list[dict] = []
        gh_count = 0
        lv_count = 0
        miss_count = 0

        for fut in asyncio.as_completed(tasks):
            name, result = await fut
            if result is None:
                miss_count += 1
                print(f"  ❌ {name[:30]:<30} → not found on Greenhouse or Lever", flush=True)
            else:
                hits.append(result)
                if result["ats"] == "greenhouse":
                    gh_count += 1
                else:
                    lv_count += 1
                slug_disp = f"{result['ats']}:{result['slug']}"
                print(
                    f"  ✅ {name[:30]:<30} → {slug_disp:<32} ({result['live_jobs']} jobs)",
                    flush=True,
                )

    hits.sort(key=lambda h: h["live_jobs"], reverse=True)
    OUTPUT_PATH.write_text(json.dumps(hits, indent=2, ensure_ascii=False) + "\n")

    bar = "─" * 30
    print()
    print(bar)
    print(f"Candidates probed:   {len(candidates)}")
    print(f"Found on Greenhouse: {gh_count}")
    print(f"Found on Lever:      {lv_count}")
    print(f"Not found:           {miss_count}  (likely Workday/Taleo/custom)")
    print(bar)
    print(f"Saved {len(hits)} companies → {OUTPUT_PATH.relative_to(Path.cwd()) if OUTPUT_PATH.is_relative_to(Path.cwd()) else OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
