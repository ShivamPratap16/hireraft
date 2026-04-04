import asyncio
import random
from abc import ABC, abstractmethod
from pathlib import Path

from backend.config import DATA_DIR
from backend.database import async_session
from backend.services import application_service, log_service

SESSION_DIR = DATA_DIR / "browser_sessions"
SESSION_DIR.mkdir(parents=True, exist_ok=True)


class BaseBot(ABC):
    platform: str = ""

    def __init__(
        self,
        run_id: str,
        username: str,
        password: str,
        keywords: str,
        role: str,
        location: str,
        daily_limit: int,
        resume_path: str,
        user_id: int | None = None,
        experience: str = "",
    ):
        self.run_id = run_id
        self.username = username
        self.password = password
        self.keywords = keywords
        self.role = role
        self.location = location
        self.daily_limit = daily_limit
        self.resume_path = resume_path
        self.user_id = user_id
        self.experience = experience or ""

    def _session_state_path(self) -> Path | None:
        if self.user_id is None:
            return None
        return SESSION_DIR / f"u{self.user_id}_{self.platform}.json"

    async def _log(self, level: str, message: str):
        async with async_session() as session:
            await log_service.log(session, self.run_id, self.platform, level, message, self.user_id)

    async def _random_delay(self, low: float = 2.0, high: float = 5.0):
        await asyncio.sleep(random.uniform(low, high))

    async def _can_apply_more(self) -> bool:
        async with async_session() as session:
            count = await application_service.daily_count(session, self.platform, self.user_id)
            return count < self.daily_limit

    async def _already_applied(self, job_url: str) -> bool:
        async with async_session() as session:
            return await application_service.already_applied(session, job_url, self.user_id)

    async def _duplicate_on_other_platform(self, job_title: str, company_name: str) -> bool:
        async with async_session() as session:
            return await application_service.duplicate_same_job_other_platform(
                session, self.user_id, job_title, company_name, self.platform
            )

    async def _save(self, job_title: str, company_name: str, job_url: str):
        async with async_session() as session:
            return await application_service.save_application(
                session, job_title, company_name, self.platform, job_url, self.user_id
            )

    async def _maybe_pause_for_captcha(self, page):
        url = page.url.lower()
        if any(x in url for x in ("captcha", "checkpoint", "challenge", "verify")):
            await self._log(
                "warn",
                "CAPTCHA or verification detected — complete it in the browser window (waiting up to 3 min)",
            )
            try:
                await page.wait_for_load_state("networkidle", timeout=180_000)
            except Exception:
                pass
            await self._random_delay(2, 4)

    @abstractmethod
    async def login(self, page):
        ...

    @abstractmethod
    async def search_jobs(self, page) -> list[dict]:
        """Return list of dicts: {job_title, company_name, job_url}"""
        ...

    @abstractmethod
    async def apply_to_job(self, page, job: dict) -> bool:
        """Apply to a single job. Return True if successful."""
        ...

    async def _execute_run_once(self) -> dict:
        from playwright.async_api import async_playwright

        stats = {"jobs_found": 0, "jobs_applied": 0, "jobs_skipped": 0, "error_count": 0}
        await self._log("info", "Launching browser")
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=False,
                args=["--disable-blink-features=AutomationControlled"],
            )
            state_path = self._session_state_path()
            ctx_kwargs = {
                "user_agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            }
            if state_path and state_path.exists():
                ctx_kwargs["storage_state"] = str(state_path)
                await self._log("info", "Using saved session cookies")

            context = await browser.new_context(**ctx_kwargs)
            page = await context.new_page()

            try:
                await self._log("info", "Logging in")
                await self.login(page)
                await self._maybe_pause_for_captcha(page)
                await self._random_delay()

                await self._log("info", "Searching for jobs")
                jobs = await self.search_jobs(page)
                stats["jobs_found"] = len(jobs)
                await self._log("info", f"Found {len(jobs)} jobs")

                applied = 0
                for job in jobs:
                    if not await self._can_apply_more():
                        await self._log("info", "Daily limit reached, stopping")
                        break

                    if await self._already_applied(job["job_url"]):
                        await self._log("info", f"Already applied: {job['job_title']}")
                        stats["jobs_skipped"] += 1
                        continue

                    if await self._duplicate_on_other_platform(
                        job["job_title"], job.get("company_name") or ""
                    ):
                        await self._log(
                            "info",
                            f"Skipping (same job on another platform): {job['job_title']}",
                        )
                        stats["jobs_skipped"] += 1
                        continue

                    await self._random_delay()
                    success = await self.apply_to_job(page, job)
                    if success:
                        await self._save(job["job_title"], job["company_name"], job["job_url"])
                        applied += 1
                        stats["jobs_applied"] += 1
                        await self._log(
                            "info",
                            f"Applied #{applied}: {job['job_title']} @ {job['company_name']}",
                        )
                    else:
                        stats["jobs_skipped"] += 1
                        await self._log("warn", f"Failed to apply: {job['job_title']}")

                await self._log("info", f"Session complete. Applied to {applied} jobs.")

                if state_path:
                    try:
                        await context.storage_state(path=str(state_path))
                    except Exception:
                        pass
            except Exception as e:
                stats["error_count"] += 1
                await self._log("error", f"Error: {e}")
                raise
            finally:
                await browser.close()

        return stats

    async def run(self) -> dict:
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                return await self._execute_run_once()
            except Exception as e:
                last_exc = e
                await self._log("warn", f"Run attempt {attempt + 1} failed: {e}; retrying once with fresh session")
                if state_path := self._session_state_path():
                    try:
                        state_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                await self._random_delay(3, 6)
        if last_exc:
            await self._log("error", f"Bot failed after retry: {last_exc}")
        return {
            "jobs_found": 0,
            "jobs_applied": 0,
            "jobs_skipped": 0,
            "error_count": 1,
        }
