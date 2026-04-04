from backend.bots.base import BaseBot


class LinkedInBot(BaseBot):
    platform = "linkedin"

    async def login(self, page):
        await page.goto("https://www.linkedin.com/login")
        await page.fill('input#username', self.username)
        await page.fill('input#password', self.password)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        await self._random_delay(3, 6)

        if "checkpoint" in page.url or "challenge" in page.url:
            await self._log("warn", "2FA / CAPTCHA detected — complete manually in the browser window")
            await page.wait_for_url("**/feed/**", timeout=120_000)

        await self._log("info", "Login complete")

    async def search_jobs(self, page) -> list[dict]:
        from urllib.parse import quote_plus

        keyword_str = (self.role or self.keywords).replace(",", " ").strip() or "software"
        raw_loc = (self.location or "").strip()
        loc_list = [l.strip() for l in raw_loc.split(",") if l.strip()] if raw_loc else [""]
        seen: set[str] = set()
        jobs: list[dict] = []

        for location_str in loc_list:
            for page_idx in range(3):
                start = page_idx * 25
                url = (
                    f"https://www.linkedin.com/jobs/search/"
                    f"?keywords={quote_plus(keyword_str)}&location={quote_plus(location_str)}"
                    f"&f_AL=true&start={start}"
                )
                await page.goto(url)
                await page.wait_for_load_state("networkidle")
                await self._random_delay(2, 4)

                cards = await page.query_selector_all(
                    "div.job-card-container, li.jobs-search-results__list-item"
                )
                if not cards:
                    break
                page_added = 0
                for card in cards:
                    title_el = await card.query_selector("a.job-card-list__title, a.job-card-container__link")
                    company_el = await card.query_selector(
                        "span.job-card-container__primary-description, "
                        "div.artdeco-entity-lockup__subtitle"
                    )
                    if not title_el:
                        continue

                    title = (await title_el.inner_text()).strip()
                    href = await title_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = f"https://www.linkedin.com{href}"
                    company = (await company_el.inner_text()).strip() if company_el else "Unknown"

                    if href and href not in seen:
                        seen.add(href)
                        jobs.append({"job_title": title, "company_name": company, "job_url": href})
                        page_added += 1
                if page_added == 0:
                    break

        return jobs

    async def apply_to_job(self, page, job: dict) -> bool:
        try:
            await page.goto(job["job_url"])
            await page.wait_for_load_state("networkidle")
            await self._random_delay(2, 4)

            easy_apply = await page.query_selector(
                'button:has-text("Easy Apply"), button.jobs-apply-button'
            )
            if not easy_apply:
                await self._log("info", f"No Easy Apply for {job['job_title']}, skipping")
                return False

            await easy_apply.click()
            await page.wait_for_timeout(2000)

            MAX_STEPS = 5
            for _ in range(MAX_STEPS):
                submit = await page.query_selector(
                    'button:has-text("Submit application"), '
                    'button[aria-label="Submit application"]'
                )
                if submit:
                    await submit.click()
                    await page.wait_for_timeout(2000)
                    return True

                next_btn = await page.query_selector(
                    'button:has-text("Next"), button:has-text("Review"), '
                    'button[aria-label="Continue to next step"]'
                )
                if next_btn:
                    await next_btn.click()
                    await page.wait_for_timeout(1500)
                else:
                    break

            await self._log("warn", f"Could not complete Easy Apply flow for {job['job_title']}")
            dismiss = await page.query_selector('button[aria-label="Dismiss"]')
            if dismiss:
                await dismiss.click()
            return False
        except Exception as e:
            await self._log("error", f"Apply error: {e}")
            return False
