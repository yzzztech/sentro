"""
Extract data from Sentry API.

Pulls: organizations → projects → issues → events.
Saves state after each page so migration is resumable.

Usage as module:
    from sentry_extract import SentryExtractor
    extractor = SentryExtractor(auth_token="...", org_slug="my-org")
    projects = extractor.extract_projects()
    for p in projects:
        issues = extractor.extract_issues(project_slug=p["slug"])
        for issue in issues:
            events = extractor.extract_events(issue["id"])
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse, parse_qs

import requests


SENTRY_API_BASE = "https://sentry.io/api/0"
PAGE_SIZE = 100  # Sentry max
RATE_LIMIT_DELAY = 1.0  # seconds between requests


def _utc_now_iso() -> str:
    """ISO 8601 with Z suffix (Sentro-compatible)."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + str(now.microsecond // 1000).zfill(3) + "Z"


class SentryExtractor:
    """Pulls data from Sentry's REST API with pagination and resume."""

    def __init__(
        self,
        auth_token: str,
        org_slug: str,
        state_dir: str = "./migration_state",
        api_base: str = SENTRY_API_BASE,
    ):
        self.auth_token = auth_token
        self.org_slug = org_slug
        self.api_base = api_base.rstrip("/")
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Accept": "application/json",
        })
        self._request_count = 0

    # ── state file helpers ──────────────────────────────────────────

    def _state_path(self, key: str) -> Path:
        return self.state_dir / f"extract_{key}.json"

    def _load_state(self, key: str) -> dict:
        path = self._state_path(key)
        if path.exists():
            return json.loads(path.read_text())
        return {}

    def _save_state(self, key: str, data: dict):
        self._state_path(key).write_text(json.dumps(data, indent=2, default=str))

    # ── HTTP helpers ────────────────────────────────────────────────

    def _get_paginated(self, url: str, state_key: str) -> list[dict]:
        """GET a paginated Sentry endpoint. Resumes from cursor if state exists."""
        state = self._load_state(state_key)
        cursor = state.get("cursor")
        all_results: list[dict] = state.get("results", [])

        params: dict[str, str] = {}
        if cursor:
            params["cursor"] = cursor

        page = 0
        while True:
            self._request_count += 1
            resp = self.session.get(url, params=params)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "5"))
                print(f"  ⏳ Rate limited, waiting {retry_after}s...")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()

            # Sentry pagination: response is a list with Link headers
            data = resp.json()
            if isinstance(data, list):
                all_results.extend(data)
                page += 1
                # Check Link header for next page
                link = resp.headers.get("Link", "")
                if 'rel="next"' not in link:
                    break
                # Extract cursor from Link header
                cursor = self._parse_next_cursor(link)
                params["cursor"] = cursor or ""
                # Save state
                self._save_state(state_key, {"cursor": cursor or "", "results": all_results})
                print(f"  📄 Page {page}: {len(data)} items (total: {len(all_results)})")
                time.sleep(RATE_LIMIT_DELAY)
            else:
                # Object response (single item)
                all_results.append(data)
                break

        # Clear state on completion
        self._state_path(state_key).unlink(missing_ok=True)
        return all_results

    def _parse_next_cursor(self, link_header: str) -> Optional[str]:
        """Parse cursor from Link header: <url>; rel="next"; results="true"; cursor="..." """
        for part in link_header.split(","):
            if 'rel="next"' in part:
                # Extract cursor value
                m = re.search(r'cursor="([^"]+)"', part)
                if m:
                    return m.group(1)
                # Fallback: extract URL
                m2 = re.search(r'<([^>]+)>', part)
                if m2:
                    qs = parse_qs(urlparse(m2.group(1)).query)
                    return qs.get("cursor", [None])[0]
        return None

    def _get(self, url: str) -> dict:
        """Simple GET for single resources."""
        self._request_count += 1
        resp = self.session.get(url)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            return self._get(url)
        resp.raise_for_status()
        return resp.json()

    # ── extraction methods ──────────────────────────────────────────

    def extract_organizations(self) -> list[dict]:
        """List all organizations accessible to this token."""
        print(f"🔍 Extracting organizations...")
        orgs = self._get(f"{self.api_base}/organizations/")
        if isinstance(orgs, list):
            print(f"  Found {len(orgs)} organizations")
        return orgs if isinstance(orgs, list) else [orgs]

    def extract_projects(self) -> list[dict]:
        """List all projects in the target organization."""
        print(f"🔍 Extracting projects for org '{self.org_slug}'...")
        url = f"{self.api_base}/organizations/{self.org_slug}/projects/"
        projects = self._get_paginated(url, f"projects_{self.org_slug}")
        print(f"  ✅ {len(projects)} projects extracted")
        return projects

    def extract_issues(
        self,
        project_slug: str,
        query: str = "is:unresolved",
        max_issues: Optional[int] = None,
    ) -> list[dict]:
        """
        Extract issues for a project.
        query: Sentry search query (default: unresolved only)
        max_issues: cap the number of issues (None = all)
        """
        state_key = f"issues_{self.org_slug}_{project_slug}"
        print(f"🔍 Extracting issues for project '{project_slug}'...")
        url = f"{self.api_base}/projects/{self.org_slug}/{project_slug}/issues/"
        params_base = {"query": query, "statsPeriod": ""}
        state = self._load_state(state_key)
        cursor = state.get("cursor")
        all_results: list[dict] = state.get("results", [])

        params: dict[str, str] = params_base.copy()
        if cursor:
            params["cursor"] = cursor

        page = 0
        while True:
            self._request_count += 1
            resp = self.session.get(url, params=params)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "5"))
                print(f"  ⏳ Rate limited, waiting {retry_after}s...")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()

            data = resp.json()
            all_results.extend(data)
            page += 1

            if max_issues and len(all_results) >= max_issues:
                all_results = all_results[:max_issues]
                break

            link = resp.headers.get("Link", "")
            if 'rel="next"' not in link:
                break

            cursor = self._parse_next_cursor(link)
            params["cursor"] = cursor or ""
            self._save_state(state_key, {"cursor": cursor or "", "results": all_results})
            print(f"  📄 Page {page}: {len(data)} issues (total: {len(all_results)})")
            time.sleep(RATE_LIMIT_DELAY)

        self._state_path(state_key).unlink(missing_ok=True)
        print(f"  ✅ {len(all_results)} issues extracted")
        return all_results

    def extract_events(
        self,
        issue_id: str,
        max_events_per_issue: int = 50,
    ) -> list[dict]:
        """
        Extract individual events for an issue.
        Sentry returns event summaries; we fetch full event details.
        """
        state_key = f"events_{issue_id}"
        url = f"{self.api_base}/issues/{issue_id}/events/"
        events = self._get_paginated(url, state_key)

        if max_events_per_issue and len(events) > max_events_per_issue:
            events = events[-max_events_per_issue:]  # Keep most recent

        # Fetch full event details
        full_events = []
        for i, evt in enumerate(events):
            event_id = evt.get("eventID") or evt.get("id")
            if not event_id:
                full_events.append(evt)
                continue
            try:
                detail = self._get(
                    f"{self.api_base}/issues/{issue_id}/events/{event_id}/"
                )
                full_events.append(detail)
            except Exception:
                full_events.append(evt)  # Fallback to summary

            if (i + 1) % 10 == 0:
                print(f"  📄 Events: {i + 1}/{len(events)}")
            time.sleep(0.2)  # Be gentle

        return full_events

    def extract_project_details(self, project_slug: str) -> dict:
        """Get full project details including team, settings, etc."""
        url = f"{self.api_base}/projects/{self.org_slug}/{project_slug}/"
        return self._get(url)

    def extract_all(
        self,
        max_issues_per_project: Optional[int] = None,
        max_events_per_issue: int = 50,
    ) -> dict:
        """
        Full extraction: projects → issues → events.
        Returns a dict keyed by project_slug.
        """
        result: dict[str, dict] = {}
        projects = self.extract_projects()

        for proj in projects:
            slug = proj["slug"]
            print(f"\n{'='*60}")
            print(f"📦 Project: {slug}")
            print(f"{'='*60}")

            # Project metadata
            project_data = {
                "info": proj,
                "details": None,
                "issues": [],
            }

            try:
                project_data["details"] = self.extract_project_details(slug)
            except Exception as e:
                print(f"  ⚠️  Could not fetch project details: {e}")

            # Issues
            try:
                issues = self.extract_issues(slug, max_issues=max_issues_per_project)
            except Exception as e:
                print(f"  ⚠️  Could not extract issues: {e}")
                issues = []

            for issue in issues:
                issue_id = issue["id"]
                issue_data = {
                    "issue": issue,
                    "events": [],
                }
                try:
                    evts = self.extract_events(
                        issue_id, max_events_per_issue=max_events_per_issue
                    )
                    issue_data["events"] = evts
                except Exception as e:
                    print(f"  ⚠️  Could not extract events for {issue_id}: {e}")

                project_data["issues"].append(issue_data)

            result[slug] = project_data

            # Save incrementally so interrupted runs don't lose everything
            output_path = self.state_dir / "full_extraction.json"
            output_path.write_text(json.dumps(result, indent=2, default=str))

        print(f"\n✅ Full extraction saved to {self.state_dir / 'full_extraction.json'}")
        print(f"   Total API requests: {self._request_count}")

        return result
