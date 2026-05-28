"""Greenhouse apply bot — fills the public form at boards.greenhouse.io/<slug>/jobs/<id>."""

from __future__ import annotations

from backend.bots.ats_base import AtsApplyBot


APPLY_SELECTORS = [
    "button[data-mapped-qa='apply-button']",   # stable Greenhouse QA hook
    "text=Apply for this Job",
    "text=Apply Now",
    "text=Apply Here",
    "text=Submit Application",
]


class GreenhouseBot(AtsApplyBot):
    ats = "greenhouse"

    async def fill_and_submit(self, page) -> bool:
        clicked = False
        for sel in APPLY_SELECTORS:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                clicked = True
                break
        if not clicked:
            await self._log("error", "no apply button found")
            return False

        if not self.profile.full_name or not self.profile.phone:
            await self._log("error", "profile incomplete (full_name or phone missing)")
            return False

        from backend.services.match_dispatcher import _user_email
        email = await _user_email(self.user_id)
        if not email:
            await self._log("error", "no user email")
            return False

        name_parts = self.profile.full_name.split(maxsplit=1)
        first = name_parts[0]
        last = name_parts[1] if len(name_parts) > 1 else ""

        try:
            await page.fill('input[autocomplete="given-name"]', first)
            await page.fill('input[autocomplete="family-name"]', last)
            await page.fill('input[type="email"]', email)
            await page.fill('input[autocomplete="tel"]', self.profile.phone)
            await page.set_input_files('input[type="file"]', self.resume_path)
        except Exception as e:
            await self._log("error", f"failed to fill standard fields: {e}")
            return False

        if self.profile.linkedin_url:
            try:
                await page.fill('input[name*="linkedin"]', self.profile.linkedin_url)
            except Exception:
                pass  # field may not exist on every board

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
            await page.wait_for_url("**/confirmation**", timeout=20_000)
            return True
        except Exception:
            screenshot_path = f"/tmp/hireraft_failed_{self.run_id}.png"
            try:
                await page.screenshot(path=screenshot_path)
                await self._log(
                    "error",
                    f"confirmation page never loaded; screenshot at {screenshot_path}",
                )
            except Exception:
                await self._log("error", "confirmation page never loaded; screenshot also failed")
            return False
