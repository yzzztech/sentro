# Changelog

All notable changes to Sentro are documented here.

## [0.2.1] - 2026-05-24

### Fixed
- **DSN token precedence bug (#1)** — When a client sends the full DSN URL (e.g. `http://TOKEN@host/api/ingest/PROJECT`) in the JSON body's `dsn` field — which the official Claude Code hook does — the full URL shadowed the Bearer token, causing all events to be silently dropped with `401 Invalid DSN token`. Now extracts the token from URL-shaped DSNs with correct precedence: Bearer > token_from_url > plain_dsn.

### Added
- **Multica Agent monitoring** — `tools/sentro-multica-watcher.py` tails the Multica daemon log and reports agent runs (completions, failures, blocks) to Sentro in real-time.
- **Usage & Cost tracking** — Sentro API key `sk_*` can now fetch project runs, costs, tokens, and success rates via `/api/projects/:id/runs`. Live dashboard at `~/Desktop/multica-usage.html`.

### Infrastructure
- Added `totalCost` and `totalTokens` columns to AgentRun model
- Agent Runs endpoint now returns cost and token data

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

## [0.1.1] - 2026-03-01

### Added
- TypeScript SDK on [npm](https://www.npmjs.com/package/@sentro/sdk)
- Python SDK on [PyPI](https://pypi.org/project/sentro-sdk/)
- Code coverage: TS 96%, Python 94%
- Event webhooks (5 event types, HMAC signing, filters)
- Security hardening: SSRF protection, rate limiting, session cleanup
- GitHub Actions CI pipeline
- CORS middleware for cross-origin SDKs
- Framework integrations: Claude Code, OpenClaw, LangChain, CrewAI, Vercel AI SDK
- One-line installers for Claude Code and OpenClaw
- OTLP ingestion — accept OpenTelemetry traces at `/api/v1/traces`
