from backend.bots.base import BaseBot


class IndeedBot(BaseBot):
    platform = "indeed"

    async def login(self, page):
        await page.goto("https://secure.indeed.com/auth")
        await page.fill('input[name="__email"], input#ifl-InputFormField-3', self.username)
        submit = await page.query_selector('button[type="submit"]')
        if submit:
            await submit.click()
        await page.wait_for_load_state("networkidle")
        await self._random_delay(2, 4)

        pw_field = await page.query_selector('input[type="password"]')
        if pw_field:
            await pw_field.fill(self.password)
            submit = await page.query_selector('button[type="submit"]')
            if submit:
                await submit.click()
            await page.wait_for_load_state("networkidle")

        await self._log("info", "Login submitted")

    async def search_jobs(self, page) -> list[dict]:
        from urllib.parse import quote_plus

        keyword_str = (self.role or self.keywords).replace(",", " ").strip() or "software"
        raw_loc = (self.location or "").strip()
        loc_list = [l.strip() for l in raw_loc.split(",") if l.strip()] if raw_loc else [""]
        seen: set[str] = set()
        jobs: list[dict] = []

        for location_str in loc_list:
            for start in (0, 10, 20):
                url = (
                    f"https://www.indeed.com/jobs?q={quote_plus(keyword_str)}"
                    f"&l={quote_plus(location_str)}&start={start}"
                )
                await page.goto(url)
                await page.wait_for_load_state("networkidle")
                await self._random_delay(1, 2)

                cards = await page.query_selector_all("div.job_seen_beacon, div.jobsearch-ResultsList > div")
                if not cards:
                    break
                for card in cards:
                    title_el = await card.query_selector("h2.jobTitle a, a.jcs-JobTitle")
                    company_el = await card.query_selector("span[data-testid='company-name'], span.companyName")
                    if not title_el:
                        continue

                    title = (await title_el.inner_text()).strip()
                    href = await title_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = f"https://www.indeed.com{href}"
                    company = (await company_el.inner_text()).strip() if company_el else "Unknown"

                    if href and href not in seen:
                        seen.add(href)
                        jobs.append({"job_title": title, "company_name": company, "job_url": href})

        return jobs

    async def apply_to_job(self, page, job: dict) -> bool:
        try:
            await page.goto(job["job_url"])
            await page.wait_for_load_state("networkidle")
            await self._random_delay(1, 3)

            apply_btn = await page.query_selector(
                'button:has-text("Apply now"), a:has-text("Apply now"), '
                'button#indeedApplyButton'
            )
            if not apply_btn:
                await self._log("warn", f"No apply button for {job['job_title']}")
                return False

            await apply_btn.click()
            await page.wait_for_timeout(3000)

            continue_btn = await page.query_selector('button:has-text("Continue"), button:has-text("Submit")')
            if continue_btn:
                await continue_btn.click()
                await page.wait_for_timeout(1000)

            return True
        except Exception as e:
            await self._log("error", f"Apply error: {e}")
            return False
