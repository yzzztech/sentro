#!/usr/bin/env python3
"""
Sentry → Sentro Migration Tool

Migrate error data from Sentry to Sentro in 3 phases:
  1. extract — Pull projects, issues, events from Sentry API
  2. transform — Map to Sentro data model
  3. import — Create projects + batch-ingest events

USAGE:
    python migrate.py extract \\
        --sentry-token TOKEN \\
        --org-slug my-org

    python migrate.py transform

    python migrate.py import \\
        --sentro-url http://localhost:3001 \\
        --email admin@example.com \\
        --password sentro123

    python migrate.py all \\
        --sentry-token TOKEN \\
        --org-slug my-org \\
        --sentro-url http://localhost:3001 \\
        --email admin@example.com \\
        --password sentro123

    python migrate.py all \\
        --sentry-token TOKEN \\
        --org-slug my-org \\
        --sentro-url http://localhost:3001 \\
        --email admin@example.com \\
        --password sentro123 \\
        --dry-run

RESUME:
    Migration saves state after each page. Re-run the same command to resume.
    Delete ./migration_state/ to start fresh.

ENV VARS (alternative to CLI flags):
    SENTRY_AUTH_TOKEN
    SENTRO_EMAIL
    SENTRO_PASSWORD
"""

import argparse
import os
import sys
from pathlib import Path

# Add tools dir to path
sys.path.insert(0, str(Path(__file__).parent))

from sentry_extract import SentryExtractor
from transform import transform_extraction
from sentro_import import SentroImporter


STATE_DIR = "./migration_state"


def cmd_extract(args):
    """Phase 1: Extract data from Sentry."""
    token = args.sentry_token or os.environ.get("SENTRY_AUTH_TOKEN")
    if not token:
        print("❌ Sentry auth token required. Use --sentry-token or SENTRY_AUTH_TOKEN")
        sys.exit(1)

    extractor = SentryExtractor(
        auth_token=token,
        org_slug=args.org_slug,
        state_dir=STATE_DIR,
        api_base=f"{args.sentry_url}/api/0",
    )

    max_issues = None
    if args.max_issues:
        max_issues = int(args.max_issues)

    extractor.extract_all(
        max_issues_per_project=max_issues,
        max_events_per_issue=args.max_events,
    )


def cmd_transform(args):
    """Phase 2: Transform extracted data to Sentro format."""
    extraction_path = Path(STATE_DIR) / "full_extraction.json"
    if not extraction_path.exists():
        print(f"❌ No extraction found at {extraction_path}")
        print("   Run 'python migrate.py extract ...' first")
        sys.exit(1)

    import json
    extraction = json.loads(extraction_path.read_text())

    transformed = transform_extraction(
        extraction,
        max_events_per_issue=args.max_events,
    )

    output_path = Path(STATE_DIR) / "transformed.json"
    output_path.write_text(json.dumps(transformed, indent=2, default=str))

    total_events = sum(len(v) for v in transformed.values())
    print(f"✅ Transformed {len(transformed)} projects, {total_events} events")
    print(f"   Output: {output_path}")


def cmd_import(args):
    """Phase 3: Import transformed data into Sentro."""
    transformed_path = Path(STATE_DIR) / "transformed.json"
    if not transformed_path.exists():
        print(f"❌ No transformed data found at {transformed_path}")
        print("   Run 'python migrate.py extract ...' then 'python migrate.py transform' first")
        sys.exit(1)

    import json
    transformed = json.loads(transformed_path.read_text())

    email = args.email or os.environ.get("SENTRO_EMAIL")
    password = args.password or os.environ.get("SENTRO_PASSWORD")

    importer = SentroImporter(
        sentro_url=args.sentro_url,
        email=email,
        password=password,
        state_dir=STATE_DIR,
    )

    if email and password:
        importer.login()

    importer.import_all(transformed, dry_run=args.dry_run)


def cmd_all(args):
    """Run all three phases."""
    print("=" * 60)
    print("🚀 Sentry → Sentro Migration")
    print("=" * 60)

    # Phase 1: Extract
    print("\n" + "─" * 40)
    print("📥 PHASE 1: EXTRACT")
    print("─" * 40)
    cmd_extract(args)

    # Phase 2: Transform
    print("\n" + "─" * 40)
    print("🔄 PHASE 2: TRANSFORM")
    print("─" * 40)
    cmd_transform(args)

    # Phase 3: Import
    print("\n" + "─" * 40)
    print("📤 PHASE 3: IMPORT")
    print("─" * 40)
    cmd_import(args)

    print("\n" + "=" * 60)
    print("✅ Migration complete!") 
    print(f"   Check Sentro dashboard: {args.sentro_url}")
    print("=" * 60)


def cmd_status(args):
    """Show migration progress."""
    print("📊 Migration Status\n")

    state_dir = Path(STATE_DIR)

    # Extraction state
    extraction_path = state_dir / "full_extraction.json"
    if extraction_path.exists():
        import json
        extraction = json.loads(extraction_path.read_text())
        total_issues = sum(
            len(data.get("issues", [])) for data in extraction.values()
        )
        total_events = sum(
            sum(len(issue.get("events", [])) for issue in data.get("issues", []))
            for data in extraction.values()
        )
        print(f"✅ EXTRACTED: {len(extraction)} projects, {total_issues} issues, {total_events} events")
    else:
        # Check partial state
        extract_files = list(state_dir.glob("extract_*.json"))
        if extract_files:
            print(f"⏳ EXTRACTING: {len(extract_files)} state files (resumable)")
        else:
            print(f"❌ EXTRACT: Not started")

    # Transform state
    transform_path = state_dir / "transformed.json"
    if transform_path.exists():
        import json
        transformed = json.loads(transform_path.read_text())
        total_events = sum(len(v) for v in transformed.values())
        print(f"✅ TRANSFORMED: {len(transformed)} projects, {total_events} events")
    else:
        print(f"❌ TRANSFORM: Not started")

    # Import state
    import_path = state_dir / "import_state.json"
    if import_path.exists():
        import json
        state = json.loads(import_path.read_text())
        print(f"✅ IMPORTED: {len(state['created_projects'])} projects, {state['ingested_events']} events")
        if state.get("failed_events"):
            print(f"   ⚠️  {state['failed_events']} failed events")
    else:
        print(f"❌ IMPORT: Not started")


def cmd_clean(args):
    """Remove migration state to start fresh."""
    import shutil
    state_dir = Path(STATE_DIR)
    if state_dir.exists():
        shutil.rmtree(state_dir)
        print(f"✅ Removed {STATE_DIR}/")
    else:
        print(f"⏭️  No state to clean")


def main():
    parser = argparse.ArgumentParser(
        description="Sentry → Sentro Migration Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command")

    # ── extract ──
    p_extract = sub.add_parser("extract", help="Extract data from Sentry API")
    p_extract.add_argument("--sentry-token", help="Sentry auth token (or set SENTRY_AUTH_TOKEN)")
    p_extract.add_argument("--sentry-url", default="https://sentry.io", help="Sentry base URL (for self-hosted: https://sentry.example.com)")
    p_extract.add_argument("--org-slug", required=True, help="Sentry organization slug")
    p_extract.add_argument("--max-issues", type=int, help="Max issues per project")
    p_extract.add_argument("--max-events", type=int, default=50, help="Max events per issue (default: 50)")

    # ── transform ──
    p_transform = sub.add_parser("transform", help="Transform extracted data")
    p_transform.add_argument("--max-events", type=int, default=50, help="Max events per issue (default: 50)")

    # ── import ──
    p_import = sub.add_parser("import", help="Import into Sentro")
    p_import.add_argument("--sentro-url", default="http://localhost:3001", help="Sentro URL")
    p_import.add_argument("--email", help="Sentro login email (or set SENTRO_EMAIL)")
    p_import.add_argument("--password", help="Sentro login password (or set SENTRO_PASSWORD)")
    p_import.add_argument("--dry-run", action="store_true", help="Validate without writing")

    # ── all ──
    p_all = sub.add_parser("all", help="Run all phases")
    p_all.add_argument("--sentry-token", help="Sentry auth token")
    p_all.add_argument("--sentry-url", default="https://sentry.io", help="Sentry base URL (for self-hosted)")
    p_all.add_argument("--org-slug", required=True, help="Sentry organization slug")
    p_all.add_argument("--max-issues", type=int, help="Max issues per project")
    p_all.add_argument("--max-events", type=int, default=50, help="Max events per issue (default: 50)")
    p_all.add_argument("--sentro-url", default="http://localhost:3001", help="Sentro URL")
    p_all.add_argument("--email", help="Sentro login email")
    p_all.add_argument("--password", help="Sentro login password")
    p_all.add_argument("--dry-run", action="store_true", help="Validate without writing")

    # ── status ──
    sub.add_parser("status", help="Show migration progress")

    # ── clean ──
    sub.add_parser("clean", help="Remove migration state (start fresh)")

    args = parser.parse_args()

    if args.command == "extract":
        cmd_extract(args)
    elif args.command == "transform":
        cmd_transform(args)
    elif args.command == "import":
        cmd_import(args)
    elif args.command == "all":
        cmd_all(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "clean":
        cmd_clean(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
