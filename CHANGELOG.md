# Changelog

All notable changes to Sentro are documented here.

## [0.2.0] - 2026-04-14

### Added
- **OpenTelemetry (OTLP) ingestion** — `POST /api/v1/traces` accepts OTLP/HTTP JSON traces. Works with any OTEL-instrumented app (OpenLLMetry, Traceloop, OpenInference, raw OTEL SDK). No Sentro SDK required.
- **Session grouping** — group related runs into conversation threads. `sessionId` and `userId` fields on AgentRun, new `/api/projects/:id/sessions` endpoint.
- **LLM proxy mode** — zero-code instrumentation. Point your OpenAI/Anthropic client at Sentro and get automatic tracking. `POST /api/v1/proxy/chat/completions` (OpenAI-compatible) and `POST /api/v1/proxy/messages` (Anthropic-compatible).
- **Prompt management** — version prompts, tag them (production/staging), fetch by name from the SDK. `sentro.getPrompt("name")` / `sentro.get_prompt("name")`. Tag promotion with exclusive mode.
- **Scoring and evals** — attach scores to runs for correctness, quality, latency, cost. Supports human raters, LLM-as-judge, and programmatic evals. `sentro.score(runId, "correctness", 0.95)`.
- **Drift and guardrail alerts** — automatic detection of looping agents (step count or duration), token burn, and repeated tool calls. Fires `drift_detected` webhook with per-project configurable thresholds.
- **Datasets** — save runs as test fixtures for regression testing. `sentro.getDataset("my-dataset")` / `sentro.get_dataset("my-dataset")`. Import existing runs as dataset items with one API call.
- **Dataset evaluations** — `sentro.runEval()` / `sentro.run_eval()` with built-in evaluators (exactMatch, contains, regexMatch). Iterates dataset, runs user agent, auto-scores against expected output.
- **Session replay UI** — animated timeline scrubber on run detail page. Play/pause, 1x-10x speed, click-to-seek. New "Replay" tab alongside existing "Timeline".
- **Playground** — edit and re-run any LLM call from the UI. Supports OpenAI-compatible and Anthropic providers. "Playground →" link on every LLM call detail.
- **Dashboard pages** for sessions, prompts, datasets, scores. Full UI coverage of all v0.2.0 backend features.
- **Seed demo script** — `npm run seed:demo` populates a dashboard with realistic runs, errors, prompts, datasets, and scores for demos.

### SDK
- **TypeScript `@sentro/sdk` 0.2.0** — adds `getPrompt()`, `score()`, and `getDataset()` methods
- **Python `sentro-sdk` 0.2.0** — adds `get_prompt()`, `score()`, and `get_dataset()` methods

### Infrastructure
- Added Prompt, PromptVersion, Score, Dataset, and DatasetItem Prisma models
- Added sessionId, userId columns to AgentRun
- Added drift threshold columns to Project (configurable per project)
- Added drift_detected enum value to WebhookEvent

## [0.1.2] - 2026-04-14

### Published
- **sentro-sdk 0.1.2 on PyPI** — bundles `sentro.integrations.langchain` (SentroMiddleware) and `sentro.integrations.crewai` (SentroCrewListener). Users can now `pip install sentro-sdk` and import the integrations directly.
- **@sentro/sdk 0.1.2 on npm** — adds `@sentro/sdk/vercel-ai` subpath export for the Vercel AI SDK telemetry middleware. Users can now `npm install @sentro/sdk` and `import { sentroMiddleware } from '@sentro/sdk/vercel-ai'`.

### Changed
- Removed stale duplicate `packages/integrations/vercel-ai/` folder — the integration now lives in `packages/sdk/src/integrations/vercel-ai.ts` and ships as a subpath export of `@sentro/sdk`.

## [0.1.1] - 2026-04-14

### Added
- **OpenTelemetry (OTLP) ingestion** — new endpoint `POST /api/v1/traces` accepts OTLP/HTTP JSON traces. Works with any OTEL-instrumented app (OpenLLMetry, Traceloop, OpenInference, raw OTEL SDK). Translates spans to Sentro's native event format and feeds through existing processor. No SDK required.
- **Framework integrations** — built-in adapters for Claude Code (shell hooks), OpenClaw (SKILL.md), LangChain (AgentMiddleware), CrewAI (BaseEventListener), Vercel AI SDK (telemetry middleware)
- **One-line installers** — `curl ... /install.sh | bash` for Claude Code and OpenClaw

### Infrastructure
- **GitHub Actions CI** — runs TypeScript SDK tests, Python SDK tests, Next.js build with Postgres, and `npm audit` on every push and PR
- **CORS middleware** — `/api/ingest` now accepts cross-origin requests from any origin, enabling browser-based SDKs
- **CONTRIBUTING.md** — development setup guide, project structure, testing instructions, and contribution workflow

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
