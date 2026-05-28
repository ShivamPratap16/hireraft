"""Single-job apply base for public ATS forms (Greenhouse, Lever).

Differs from BaseBot: no login, no search loop, one job per invocation.
Subclasses implement `fill_and_submit(page)` only.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod

from backend.bots._constants import USER_AGENT
from backend.models import Job, Profile
from backend.services import application_service, log_service


def _headless() -> bool:
    return os.getenv("HIRERAFT_ENV", "development") != "development"


class AtsApplyBot(ABC):
    ats: str = ""

    def __init__(
        self,
        run_id: str,
        user_id: str,
        job: Job,
        profile: Profile,
        resume_path: str,
    ):
        self.run_id = run_id
        self.user_id = user_id
        self.job = job
        self.profile = profile
        self.resume_path = resume_path

    @abstractmethod
    async def fill_and_submit(self, page) -> bool:
        ...

    async def _log(self, level: str, msg: str) -> None:
        await log_service.log(self.run_id, self.ats, level, msg, self.user_id)

    async def run(self) -> bool:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=_headless(),
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            try:
                response = await page.goto(self.job.job_url, wait_until="domcontentloaded")
                if response is not None and response.status == 404:
                    await self._log("warn", "job closed before apply (404)")
                    return False

                ok = await self.fill_and_submit(page)
                if ok:
                    await application_service.save_application(
                        self.job.title,
                        self.job.company_name,
                        self.ats,
                        self.job.job_url,
                        self.user_id,
                    )
                return ok
            except Exception as e:
                await self._log("error", f"bot crashed: {e}")
                return False
            finally:
                await browser.close()
