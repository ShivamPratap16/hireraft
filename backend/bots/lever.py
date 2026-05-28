"""Lever apply bot — fills the public form at jobs.lever.co/<slug>/<id>/apply."""

from __future__ import annotations

from backend.bots.ats_base import AtsApplyBot


APPLY_BUTTON_SELECTORS = [
    "a[data-qa='btn-apply-bottom']",
    "a.template-btn-submit",
    "text=Apply for this job",
    "text=Apply",
]


class LeverBot(AtsApplyBot):
    ats = "lever"

    async def fill_and_submit(self, page) -> bool:
        for sel in APPLY_BUTTON_SELECTORS:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await page.wait_for_load_state("domcontentloaded")
                break

        if not self.profile.full_name or not self.profile.phone:
            await self._log("error", "profile incomplete (full_name or phone missing)")
            return False

        from backend.services.match_dispatcher import _user_email
        email = await _user_email(self.user_id)
        if not email:
            await self._log("error", "no user email")
            return False

        try:
            await page.fill('input[name="name"]', self.profile.full_name)
            await page.fill('input[name="email"]', email)
            await page.fill('input[name="phone"]', self.profile.phone)
            await page.set_input_files('input[name="resume"]', self.resume_path)
        except Exception as e:
            await self._log("error", f"failed to fill standard fields: {e}")
            return False

        if self.profile.linkedin_url:
            try:
                await page.fill('input[name="urls[LinkedIn]"]', self.profile.linkedin_url)
            except Exception:
                pass

        required_unanswered = await page.locator(
            '[aria-required="true"]:not([value]):not(:has(option:checked))'
        ).count()
        if required_unanswered > 0:
            await self._log(
                "warn",
                f"{required_unanswered} required custom questions — skipping (slice-1 limitation)",
            )
            return False

        try:
            await page.click('button[type="submit"]')
        except Exception as e:
            await self._log("error", f"submit click failed: {e}")
            return False

        try:
            await page.wait_for_url("**/thanks**", timeout=20_000)
            return True
        except Exception:
            screenshot_path = f"/tmp/hireraft_failed_{self.run_id}.png"
            try:
                await page.screenshot(path=screenshot_path)
                await self._log(
                    "error",
                    f"confirmation (thanks) page never loaded; screenshot at {screenshot_path}",
                )
            except Exception:
                await self._log("error", "confirmation page never loaded; screenshot also failed")
            return False
