from backend.bots.base import BaseBot


class NaukriBot(BaseBot):
    platform = "naukri"

    async def login(self, page):
        await page.goto("https://www.naukri.com/nlogin/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        email_selectors = [
            '#usernameField',
            'input[name="USERNAME"]',
            'input#emailTxt',
            'input[placeholder*="Email"]',
            'input[placeholder*="email"]',
            'input[placeholder*="Username"]',
        ]

        filled = False
        for sel in email_selectors:
            try:
                el = await page.query_selector(sel)
                if el and await el.is_visible():
                    await el.fill(self.username)
                    await self._log("info", f"Email filled using selector: {sel}")
                    filled = True
                    break
            except Exception:
                continue

        if not filled:
            await self._log("error", "Could not find email field. Page title: " + await page.title())
            raise Exception("Email field not found on Naukri login page")

        await self._random_delay(0.5, 1.5)

        pw_selectors = [
            '#passwordField',
            'input[name="PASSWORD"]',
            'input#pwd1',
            'input[type="password"]',
        ]

        for sel in pw_selectors:
            try:
                el = await page.query_selector(sel)
                if el and await el.is_visible():
                    await el.fill(self.password)
                    await self._log("info", f"Password filled using selector: {sel}")
                    break
            except Exception:
                continue

        await self._random_delay(0.5, 1)

        login_selectors = [
            'button[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("login")',
            '#loginBtn',
        ]
        for sel in login_selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    break
            except Exception:
                continue

        await page.wait_for_load_state("networkidle")
        await self._random_delay(2, 4)
        await self._log("info", f"Login submitted. Current URL: {page.url}")

    async def search_jobs(self, page) -> list[dict]:
        import re
        from urllib.parse import quote_plus

        keywords = [k.strip() for k in self.keywords.split(",") if k.strip()]
        locations = [l.strip() for l in self.location.split(",") if l.strip()] if self.location else []

        query = self.role.strip() if self.role else ""
        if not query and keywords:
            query = keywords[0]
        elif not query:
            query = "software developer"

        MAX_QUERY_WORDS = 4
        query_words = query.split()
        if len(query_words) > MAX_QUERY_WORDS:
            query = " ".join(query_words[:MAX_QUERY_WORDS])

        loc_list = locations if locations else [""]
        multi_city = sum(1 for x in loc_list if x.strip()) > 1

        y_match = re.search(r"(\d+)\s*y", self.experience or "", re.I)
        exp_suffix = f"&experience={min(int(y_match.group(1)), 25)}" if y_match else ""

        all_jobs: list[dict] = []
        search_queries = [query]
        if keywords:
            search_queries.append(keywords[0])
            if len(keywords) > 2:
                search_queries.append(keywords[2])

        seen_urls: set[str] = set()

        for raw_loc in loc_list:
            location = raw_loc.strip()
            for sq in search_queries[:2]:
                sq_trimmed = " ".join(sq.split()[:MAX_QUERY_WORDS])
                for page_no in range(1, 4):
                    if location:
                        base = f"https://www.naukri.com/jobs-in-{quote_plus(location)}?k={quote_plus(sq_trimmed)}{exp_suffix}"
                    else:
                        base = f"https://www.naukri.com/jobs?k={quote_plus(sq_trimmed)}{exp_suffix}"
                    url = base + (f"&pageNo={page_no}" if page_no > 1 else "")

                    await self._log("info", f"Searching: {url}")
                    await page.goto(url, wait_until="domcontentloaded")
                    await page.wait_for_timeout(4000)

                    page_title = await page.title()
                    await self._log("info", f"Search page title (p{page_no}): {page_title}")

                    found = await self._extract_jobs_from_page(page)
                    if not found and page_no > 1:
                        break
                    for j in found:
                        if j["job_url"] not in seen_urls:
                            seen_urls.add(j["job_url"])
                            all_jobs.append(j)
                    await self._random_delay(1, 2)

                if not multi_city and all_jobs:
                    break
                await self._random_delay(2, 4)

            if not multi_city and all_jobs:
                break

        return all_jobs

    async def _extract_jobs_from_page(self, page) -> list[dict]:
        jobs = []
        card_selectors = [
            "div.srp-jobtuple-wrapper",
            "article.jobTuple",
            "div.cust-job-tuple",
            "div[class*='jobTuple']",
            "div[class*='job-tuple']",
            "div.styles_jlc__main",
            "div[data-job-id]",
            "div.list > div.tupCard",
        ]

        cards = []
        for sel in card_selectors:
            cards = await page.query_selector_all(sel)
            if cards:
                await self._log("info", f"Found {len(cards)} cards using: {sel}")
                break

        if not cards:
            await self._log("warn", "No cards with known selectors. Dumping page structure for debug...")
            snippet = await page.evaluate("""() => {
                const el = document.querySelector('#listContainer, .list, [class*=search], main, #root');
                if (!el) return document.body.innerHTML.substring(0, 1500);
                return el.innerHTML.substring(0, 1500);
            }""")
            await self._log("info", f"Page HTML snippet: {snippet[:800]}")

            all_links = await page.query_selector_all("a[href*='naukri.com/job-listings'], a[href*='/job-listings-']")
            if not all_links:
                all_links = await page.query_selector_all("a[href*='/job/']")
            for link in all_links:
                title = (await link.inner_text()).strip()
                href = await link.get_attribute("href") or ""
                if href and title and len(title) > 3:
                    if not href.startswith("http"):
                        href = f"https://www.naukri.com{href}"
                    jobs.append({"job_title": title, "company_name": "Unknown", "job_url": href})
            if jobs:
                await self._log("info", f"Found {len(jobs)} jobs via link fallback")
            return jobs

        for card in cards:
            title_el = await card.query_selector(
                "a.title, a[class*='title'], h2 a, a.heading, a[class*='jobTitle']"
            )
            company_el = await card.query_selector(
                "a.subTitle, a[class*='comp-name'], a[class*='companyName'], span[class*='comp']"
            )
            if not title_el:
                continue

            title = (await title_el.inner_text()).strip()
            href = await title_el.get_attribute("href") or ""
            if href and not href.startswith("http"):
                href = f"https://www.naukri.com{href}"
            company = (await company_el.inner_text()).strip() if company_el else "Unknown"

            if href and title:
                jobs.append({"job_title": title, "company_name": company, "job_url": href})

        return jobs

    async def apply_to_job(self, page, job: dict) -> bool:
        try:
            await page.goto(job["job_url"], wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            await self._random_delay(1, 3)

            # Check if this is an "Apply on company site" job
            company_link = await page.query_selector(
                'a:has-text("Apply on company site"), '
                'a:has-text("apply on company"), '
                'a[class*="company-site-button"]'
            )
            is_external = company_link is not None and await company_link.is_visible()

            if is_external:
                await self._log("info", f"External apply job: {job['job_title']} — attempting company site apply")
                return await self._apply_on_company_site(page, job, company_link)

            # Direct Naukri apply
            apply_selectors = [
                'button#apply-button',
                'button:has-text("Apply")',
                'button:has-text("apply")',
                'button[class*="apply"]',
            ]

            clicked = False
            pages_before = len(page.context.pages)

            for sel in apply_selectors:
                try:
                    btn = await page.query_selector(sel)
                    if not btn or not await btn.is_visible():
                        continue
                    tag = await btn.evaluate("el => el.tagName.toLowerCase()")
                    if tag != "button":
                        continue
                    await btn.click()
                    clicked = True
                    await self._log("info", f"Clicked apply with: {sel}")
                    break
                except Exception:
                    continue

            if not clicked:
                await self._log("info", f"No direct apply button: {job['job_title']}")
                return False

            await page.wait_for_timeout(2000)

            # If a new tab opened, check if it's external
            pages_after = page.context.pages
            if len(pages_after) > pages_before:
                new_tab = None
                for p in pages_after:
                    if p != page:
                        new_tab = p
                        break
                if new_tab and "naukri.com" not in new_tab.url:
                    await self._log("info", f"Apply opened external tab: {new_tab.url[:80]}")
                    applied = await self._try_external_apply(new_tab, job)
                    await new_tab.close()
                    if applied:
                        return True
                    # Save as manual_apply_needed even if external attempt failed
                    await self._save_manual(job)
                    return False
                elif new_tab:
                    await new_tab.close()

            # If redirected away from naukri
            if "naukri.com" not in page.url:
                await self._log("info", f"Redirected to: {page.url[:80]}")
                applied = await self._try_external_apply(page, job)
                await page.go_back()
                if applied:
                    return True
                await self._save_manual(job)
                return False

            # Handle chatbot / questionnaire submit
            submit_selectors = [
                'button:has-text("Submit")',
                'button:has-text("submit")',
                'button[type="submit"]',
            ]
            for sel in submit_selectors:
                try:
                    btn = await page.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(1000)
                        break
                except Exception:
                    continue

            return True
        except Exception as e:
            await self._log("error", f"Apply error: {e}")
            return False

    async def _apply_on_company_site(self, page, job: dict, link) -> bool:
        """Click the company site link and try to apply there."""
        try:
            pages_before = len(page.context.pages)
            await link.click()
            await page.wait_for_timeout(3000)

            # Check if a new tab opened
            target_page = page
            pages_after = page.context.pages
            if len(pages_after) > pages_before:
                for p in pages_after:
                    if p != page:
                        target_page = p
                        break

            await target_page.wait_for_load_state("domcontentloaded")
            external_url = target_page.url
            await self._log("info", f"On company site: {external_url[:80]}")

            applied = await self._try_external_apply(target_page, job)

            if target_page != page:
                await target_page.close()

            if applied:
                return True

            # Could not auto-apply — save for manual apply
            await self._save_manual(job)
            return False

        except Exception as e:
            await self._log("warn", f"Company site error: {e}")
            await self._save_manual(job)
            return False

    async def _try_external_apply(self, ext_page, job: dict) -> bool:
        """Best-effort apply on an external company career page."""
        try:
            await ext_page.wait_for_timeout(2000)

            apply_selectors = [
                'button:has-text("Apply")',
                'a:has-text("Apply Now")',
                'a:has-text("Apply now")',
                'button:has-text("Apply Now")',
                'a:has-text("Submit Application")',
                'button:has-text("Submit")',
                'input[type="submit"]',
                'a[class*="apply"]',
                'button[class*="apply"]',
            ]

            for sel in apply_selectors:
                try:
                    btn = await ext_page.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await self._log("info", f"Clicked external apply: {sel}")
                        await ext_page.wait_for_timeout(2000)

                        # Try to upload resume if a file input appears
                        file_input = await ext_page.query_selector('input[type="file"]')
                        if file_input and self.resume_path:
                            await file_input.set_input_files(self.resume_path)
                            await self._log("info", "Uploaded resume on external site")
                            await ext_page.wait_for_timeout(1000)

                        # Try to submit the form
                        submit = await ext_page.query_selector(
                            'button:has-text("Submit"), button[type="submit"], '
                            'input[type="submit"], button:has-text("Apply")'
                        )
                        if submit and await submit.is_visible():
                            await submit.click()
                            await self._log("info", "Submitted on external site")

                        return True
                except Exception:
                    continue

            await self._log("info", f"Could not auto-apply on external site for {job['job_title']}")
            return False
        except Exception as e:
            await self._log("warn", f"External apply attempt error: {e}")
            return False

    async def _save_manual(self, job: dict):
        """Save job with status manual_apply_needed for the dashboard."""
        from backend.database import async_session
        from backend.services.application_service import already_applied, save_application_with_status
        async with async_session() as session:
            if not await already_applied(session, job["job_url"], self.user_id):
                await save_application_with_status(
                    session, job["job_title"], job["company_name"],
                    self.platform, job["job_url"], "manual_apply_needed",
                    self.user_id,
                )
                await self._log("info", f"Saved for manual apply: {job['job_title']}")
