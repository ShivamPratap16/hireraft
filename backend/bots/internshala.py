from backend.bots.base import BaseBot


class InternshalaBot(BaseBot):
    platform = "internshala"

    async def login(self, page):
        await page.goto("https://internshala.com/login")
        await page.fill('input[name="email"]', self.username)
        await page.fill('input[name="password"]', self.password)
        await page.click('button#login_submit, button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        await self._log("info", "Login submitted")

    async def search_jobs(self, page) -> list[dict]:
        keyword_str = (self.role or self.keywords).replace(",", " ").strip() or "software"
        raw_loc = (self.location or "").strip()
        loc_list = [l.strip() for l in raw_loc.split(",") if l.strip()] if raw_loc else [""]

        seen: set[str] = set()
        jobs: list[dict] = []

        for loc in loc_list:
            base = f"https://internshala.com/internships/keywords-{keyword_str.replace(' ', '-')}"
            if loc:
                base += f"/location-{loc.replace(' ', '-')}"

            for p in range(1, 4):
                url = base + (f"/page-{p}" if p > 1 else "")
                await page.goto(url)
                await page.wait_for_load_state("networkidle")
                await self._random_delay(1, 2)

                cards = await page.query_selector_all("div.individual_internship, div.internship_meta")
                if not cards:
                    break
                for card in cards:
                    title_el = await card.query_selector("h3.heading_4_5 a, a.view_detail_button")
                    company_el = await card.query_selector("h4.heading_6, a.link_display_like_text")
                    if not title_el:
                        continue

                    title = (await title_el.inner_text()).strip()
                    href = await title_el.get_attribute("href") or ""
                    if href and not href.startswith("http"):
                        href = f"https://internshala.com{href}"
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
                '#continue_button'
            )
            if not apply_btn:
                await self._log("warn", f"No apply button for {job['job_title']}")
                return False

            await apply_btn.click()
            await page.wait_for_timeout(2000)

            submit_btn = await page.query_selector(
                'button:has-text("Submit"), button#submit'
            )
            if submit_btn:
                await submit_btn.click()
                await page.wait_for_timeout(1000)

            return True
        except Exception as e:
            await self._log("error", f"Apply error: {e}")
            return False
