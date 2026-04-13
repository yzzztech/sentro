# Changelog

All notable changes to Sentro are documented here.

## [0.1.1] - 2026-04-14

### Security
- **SSRF protection** — webhook and alert URLs are now validated against private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16), localhost, and non-HTTP protocols
- **Login rate limiting** — 5 attempts per IP per 15-minute window with 429 responses and Retry-After headers
- **Setup race condition fix** — unique constraint catch prevents creating multiple admin accounts on concurrent requests
- **Ingest validation** — event objects limited to 50 fields to prevent payload abuse
- **Session cleanup** — expired sessions now pruned by the nightly cleanup job
- **Docker credentials** — `docker-compose.yml` now uses env var substitution instead of hardcoded passwords
- **.dockerignore** — prevents `.env`, `.git`, and `node_modules` from leaking into Docker images

### Added
- **Python SDK published to PyPI** — `pip install sentro-sdk` (zero dependencies, context managers, async support, 23 tests)
- **TypeScript SDK published to npm** — `npm install @sentro/sdk` (batched transport, trace wrapper API, 21 tests)
- **Code coverage** — TypeScript SDK at 96%, Python SDK at 94%, with 80% thresholds enforced
- **Event webhooks** — 5 event types (`error.new`, `error.regression`, `run.failed`, `run.completed`, `cost.spike`), HMAC-SHA256 signing, filters, management dashboard
- **Documentation** — full HTML docs with Python SDK section, Event Webhooks section, updated roadmap
- **npm/PyPI badges** and coverage badges in README

### Changed
- Version bumped to 0.1.1 across both SDKs
- Hero badge updated from v0.1.0 to v1.0.0 in docs

## [0.1.0] - 2026-04-13

### Added
- Initial release
- Next.js 15 dashboard with issues, agent runs, step replay, performance, and alerts pages
- PostgreSQL schema with agent observability hierarchy (run → step → tool_call / llm_call)
- TypeScript SDK with explicit and wrapper trace APIs
- Python SDK with context managers
- Ingest endpoint with rate limiting and batched processing
- Alert rules (error_spike, failure_rate, cost_threshold) with webhook notifications
- pg-boss background jobs for alert checking and data cleanup
- Docker Compose deployment (app + postgres)
- Admin auth with bcrypt password hashing and session cookies
