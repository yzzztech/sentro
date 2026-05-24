"""
Import transformed data into Sentro.

Two-phase import:
1. Create projects via REST API (GET session cookie, then POST /api/projects)
2. Batch-ingest events via POST /api/ingest

Handles:
- Authentication (login → session cookie or API key)
- Rate limiting (configurable batch size, delay)
- Idempotency (skips already-seen projects, tracks ingested events)
- Resume (state file tracks progress)
"""

import json
import time
from pathlib import Path
from typing import Any, Optional

import requests


SENTRO_DEFAULT_URL = "http://localhost:3001"
INGEST_BATCH_SIZE = 50  # events per batch


class SentroImporter:
    """Import data into a Sentro instance."""

    def __init__(
        self,
        sentro_url: str = SENTRO_DEFAULT_URL,
        email: Optional[str] = None,
        password: Optional[str] = None,
        session_cookie: Optional[str] = None,
        state_dir: str = "./migration_state",
    ):
        self.sentro_url = sentro_url.rstrip("/")
        self.email = email
        self.password = password
        self.session = requests.Session()
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)

        if session_cookie:
            self.session.cookies.set("session", session_cookie, domain="localhost")

        self._project_cache: dict[str, str] = {}  # name → dsnToken
        self._ingested_count = 0
        self._failed_count = 0

    # ── auth ────────────────────────────────────────────────────────

    def login(self) -> bool:
        """Authenticate and get session cookie."""
        if not self.email or not self.password:
            print("⚠️  No credentials provided, skipping login")
            return False

        resp = self.session.post(
            f"{self.sentro_url}/api/auth/login",
            json={"email": self.email, "password": self.password},
        )
        if resp.status_code == 200:
            print("✅ Logged in to Sentro")
            return True
        else:
            print(f"❌ Login failed: {resp.status_code} {resp.text[:200]}")
            return False

    # ── state helpers ───────────────────────────────────────────────

    def _load_import_state(self) -> dict:
        path = self.state_dir / "import_state.json"
        if path.exists():
            return json.loads(path.read_text())
        return {"created_projects": {}, "ingested_events": 0, "failed_events": 0}

    def _save_import_state(self, state: dict):
        path = self.state_dir / "import_state.json"
        path.write_text(json.dumps(state, indent=2))

    # ── project creation ────────────────────────────────────────────

    def create_project(self, name: str) -> Optional[dict]:
        """
        Create a project in Sentro. Returns {id, name, dsnToken, dsnUrl}.
        Idempotent: if project already created in this session, returns cached.
        """
        if name in self._project_cache:
            return {"dsnToken": self._project_cache[name]}

        state = self._load_import_state()
        if name in state["created_projects"]:
            self._project_cache[name] = state["created_projects"][name]
            return {"dsnToken": state["created_projects"][name]}

        resp = self.session.post(
            f"{self.sentro_url}/api/projects",
            json={"name": name},
        )

        if resp.status_code == 201:
            data = resp.json()
            project = data.get("project", {})
            dsn_token = project.get("dsnToken", "")
            self._project_cache[name] = dsn_token
            state["created_projects"][name] = dsn_token
            self._save_import_state(state)
            print(f"  ✅ Created project '{name}'")
            return {"dsnToken": dsn_token, "dsnUrl": data.get("dsnUrl", "")}
        elif resp.status_code == 401:
            print(f"  🔐 Auth required — try logging in first")
            return None
        else:
            print(f"  ❌ Failed to create project '{name}': {resp.status_code} {resp.text[:200]}")
            return None

    def get_or_create_project(self, project_name: str) -> Optional[str]:
        """Get project's DSN token, creating if needed. Returns token or None."""
        result = self.create_project(project_name)
        if result:
            return result["dsnToken"]
        return None

    # ── event ingestion ─────────────────────────────────────────────

    def ingest_events(
        self,
        dsn_token: str,
        events: list[dict],
        dry_run: bool = False,
    ) -> int:
        """
        Ingest events in batches via the ingest endpoint.
        Returns number of events successfully accepted.
        """
        accepted = 0
        total = len(events)

        for i in range(0, total, INGEST_BATCH_SIZE):
            batch = events[i : i + INGEST_BATCH_SIZE]

            # Clean events: ensure project_name isn't sent to ingest
            clean_batch = []
            for evt in batch:
                clean = {k: v for k, v in evt.items() if k != "project_name"}
                clean_batch.append(clean)

            payload = {
                "dsn": dsn_token,
                "batch": clean_batch,
            }

            if dry_run:
                print(f"  🔍 [DRY RUN] Would ingest {len(clean_batch)} events to project")
                accepted += len(clean_batch)
                continue

            try:
                resp = self.session.post(
                    f"{self.sentro_url}/api/ingest",
                    json=payload,
                )

                if resp.status_code == 202:
                    data = resp.json()
                    acc = data.get("accepted", len(clean_batch))
                    accepted += acc
                    print(f"  📨 Batch {i // INGEST_BATCH_SIZE + 1}: {acc} accepted")
                elif resp.status_code == 401:
                    print(f"  ❌ Invalid DSN token for project")
                    break
                elif resp.status_code == 429:
                    print(f"  ⏳ Rate limited, waiting 5s...")
                    time.sleep(5)
                    # Retry this batch
                    resp2 = self.session.post(
                        f"{self.sentro_url}/api/ingest",
                        json=payload,
                    )
                    if resp2.status_code == 202:
                        acc2 = resp2.json().get("accepted", len(clean_batch))
                        accepted += acc2
                    else:
                        print(f"  ❌ Retry failed: {resp2.status_code}")
                else:
                    print(f"  ❌ Ingest failed: {resp.status_code} {resp.text[:200]}")
            except requests.RequestException as e:
                print(f"  ❌ Connection error: {e}")
                break

            # Gentle pacing
            time.sleep(0.5)

        self._ingested_count += accepted
        return accepted

    def import_project_events(
        self,
        project_name: str,
        events: list[dict],
        dry_run: bool = False,
    ) -> bool:
        """
        Full import: create project (if needed) + ingest all events.
        Returns True on success.
        """
        print(f"\n📦 Importing '{project_name}': {len(events)} events")

        if not events:
            print(f"  ⏭️  No events to import")
            return True

        if dry_run:
            print(f"  🔍 [DRY RUN] Would create project '{project_name}' and ingest {len(events)} events")
            self._ingested_count += len(events)
            return True

        dsn_token = self.get_or_create_project(project_name)
        if not dsn_token:
            self._failed_count += len(events)
            return False

        accepted = self.ingest_events(dsn_token, events, dry_run=dry_run)
        print(f"  ✅ {accepted}/{len(events)} events accepted")

        state = self._load_import_state()
        state["ingested_events"] = self._ingested_count
        state["failed_events"] = self._failed_count
        self._save_import_state(state)

        return accepted == len(events)

    def import_all(
        self,
        transformed: dict[str, list[dict]],
        dry_run: bool = False,
    ) -> dict:
        """
        Import all transformed project data.
        Returns summary dict.
        """
        summary = {"total_projects": len(transformed), "projects": {}}

        for project_name, events in transformed.items():
            success = self.import_project_events(project_name, events, dry_run=dry_run)
            summary["projects"][project_name] = {
                "events": len(events),
                "success": success,
            }

        summary["total_events_ingested"] = self._ingested_count
        summary["total_events_failed"] = self._failed_count

        # Save summary
        path = self.state_dir / "import_summary.json"
        path.write_text(json.dumps(summary, indent=2))
        print(f"\n📊 Import summary saved to {path}")
        print(f"   Projects: {summary['total_projects']}")
        print(f"   Events ingested: {self._ingested_count}")
        print(f"   Events failed: {self._failed_count}")

        return summary
