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
ASHBY_URL_TMPL = "https://api.ashbyhq.com/posting-api/job-board/{slug}"
WORKABLE_URL_TMPL = "https://apply.workable.com/api/v1/widget/accounts/{slug}"
SMARTRECRUITERS_URL_TMPL = "https://api.smartrecruiters.com/v1/companies/{slug}/postings"

CONCURRENCY = 20
PROBE_TIMEOUT = 5.0
YC_FETCH_TIMEOUT = 30.0

# A hit is accepted as a real Indian company only when both hold:
#   - at least MIN_INDIA_JOBS of the board's jobs match the India pattern
#   - india_rate >= MIN_INDIA_RATE
# This filters out slug collisions where the slug owns a big US/global board.
MIN_INDIA_JOBS = 1
MIN_INDIA_RATE = 0.5

INDIA_LOCATION_RE = re.compile(
    r"\b("
    r"india|"
    r"bangalore|bengaluru|"
    r"mumbai|bombay|"
    r"delhi|new delhi|"
    r"gurgaon|gurugram|"
    r"noida|"
    r"hyderabad|"
    r"pune|"
    r"chennai|madras|"
    r"kolkata|calcutta|"
    r"ahmedabad|jaipur|"
    r"kochi|cochin|kerala|"
    r"chandigarh|indore|"
    r"coimbatore|"
    r"trivandrum|thiruvananthapuram"
    r")\b",
    re.IGNORECASE,
)


def _is_india_location(loc: str) -> bool:
    return bool(loc) and INDIA_LOCATION_RE.search(loc) is not None

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
) -> Optional[tuple[int, int]]:
    """Returns (total_jobs, india_jobs) if board has jobs, else None."""
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
    if not jobs:
        return None
    india = 0
    for j in jobs:
        loc_obj = j.get("location") or {}
        loc = loc_obj.get("name", "") if isinstance(loc_obj, dict) else str(loc_obj)
        if _is_india_location(loc):
            india += 1
    return len(jobs), india


async def _probe_lever(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[tuple[int, int]]:
    """Returns (total_postings, india_postings) if board has postings, else None."""
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
    india = 0
    for p in postings:
        cats = p.get("categories") or {}
        loc = cats.get("location", "") if isinstance(cats, dict) else ""
        if _is_india_location(loc):
            india += 1
    return len(postings), india


async def _probe_ashby(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[tuple[int, int]]:
    async with sem:
        try:
            r = await client.get(
                ASHBY_URL_TMPL.format(slug=slug), timeout=PROBE_TIMEOUT
            )
        except Exception:
            return None
    if r.status_code != 200:
        return None
    try:
        jobs = r.json().get("jobs") or []
    except Exception:
        return None
    if not jobs:
        return None
    india = sum(1 for j in jobs if _is_india_location(j.get("location") or ""))
    return len(jobs), india


async def _probe_workable(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[tuple[int, int]]:
    async with sem:
        try:
            r = await client.get(
                WORKABLE_URL_TMPL.format(slug=slug), timeout=PROBE_TIMEOUT
            )
        except Exception:
            return None
    if r.status_code != 200:
        return None
    try:
        jobs = r.json().get("jobs") or []
    except Exception:
        return None
    if not jobs:
        return None
    india = 0
    for j in jobs:
        # Workable splits location across country/city; also has a structured `locations` array.
        locs = j.get("locations") or []
        flat = " ".join(
            str(j.get(k, "")) for k in ("country", "city", "state")
        )
        if _is_india_location(flat):
            india += 1
            continue
        for loc in locs if isinstance(locs, list) else []:
            if not isinstance(loc, dict):
                continue
            joined = " ".join(
                str(loc.get(k, "")) for k in ("country", "city", "region")
            )
            if _is_india_location(joined):
                india += 1
                break
    return len(jobs), india


async def _probe_smartrecruiters(
    client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
) -> Optional[tuple[int, int]]:
    """Single page is enough at probe time — caps cost. India-rate from a
    100-job sample is a good enough signal to pass/fail the filter."""
    async with sem:
        try:
            r = await client.get(
                SMARTRECRUITERS_URL_TMPL.format(slug=slug),
                params={"offset": 0, "limit": 100},
                timeout=PROBE_TIMEOUT,
            )
        except Exception:
            return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:
        return None
    content = data.get("content") or []
    if not content:
        return None
    total = int(data.get("totalFound") or len(content))
    india = 0
    for p in content:
        loc = p.get("location") or {}
        if not isinstance(loc, dict):
            continue
        joined = " ".join(
            str(loc.get(k, "")) for k in ("city", "region", "country")
        )
        if _is_india_location(joined):
            india += 1
    # If we sampled the first 100 and saw an India-rate, project it across totalFound
    # to make _passes_india_filter consistent regardless of board size.
    sampled = len(content)
    if total > sampled and sampled > 0:
        india = round(india * total / sampled)
    return total, india


def _passes_india_filter(total: int, india: int) -> bool:
    """Accept the hit as 'India-focused' only if both thresholds are met."""
    if total <= 0 or india < MIN_INDIA_JOBS:
        return False
    return (india / total) >= MIN_INDIA_RATE


# Ordered so we prefer the cleanest APIs first when multiple match the same slug.
_PROBES = (
    ("greenhouse", _probe_greenhouse),
    ("lever", _probe_lever),
    ("ashby", _probe_ashby),
    ("workable", _probe_workable),
    ("smartrecruiters", _probe_smartrecruiters),
)


async def find_company_ats(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    name: str,
) -> tuple[str, Optional[dict]]:
    """Try slug variants × all 5 ATS in parallel per slug. First passing hit wins.

    A slug "hits" only if the response has live jobs AND >= MIN_INDIA_RATE of them
    match the India location pattern — this filters slug-collision false positives.
    """
    try:
        for slug in slug_candidates(name):
            results = await asyncio.gather(
                *(probe(client, sem, slug) for _, probe in _PROBES),
                return_exceptions=False,
            )
            for (ats, _), result in zip(_PROBES, results):
                if result is None:
                    continue
                total, india = result
                if _passes_india_filter(total, india):
                    return name, {
                        "name": name,
                        "ats": ats,
                        "slug": slug,
                        "live_jobs": total,
                        "india_jobs": india,
                    }
    except Exception:
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
        per_ats_count: dict[str, int] = {ats: 0 for ats, _ in _PROBES}
        miss_count = 0

        for fut in asyncio.as_completed(tasks):
            name, result = await fut
            if result is None:
                miss_count += 1
                print(f"  ❌ {name[:30]:<30} → not found on any ATS", flush=True)
            else:
                hits.append(result)
                per_ats_count[result["ats"]] = per_ats_count.get(result["ats"], 0) + 1
                slug_disp = f"{result['ats']}:{result['slug']}"
                jobs_disp = f"{result['india_jobs']}/{result['live_jobs']} in India"
                print(
                    f"  ✅ {name[:30]:<30} → {slug_disp:<32} ({jobs_disp})",
                    flush=True,
                )

    hits.sort(key=lambda h: h["live_jobs"], reverse=True)
    OUTPUT_PATH.write_text(json.dumps(hits, indent=2, ensure_ascii=False) + "\n")

    bar = "─" * 30
    print()
    print(bar)
    print(f"Candidates probed:   {len(candidates)}")
    for ats, _ in _PROBES:
        print(f"Found on {ats:<16} {per_ats_count.get(ats, 0)}")
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
