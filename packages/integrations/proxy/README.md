# @sentro/proxy — Zero-Code LLM Observability

Change one line — your `base_url` — and Sentro automatically captures every
LLM call your app makes: request, response, tokens, cost, latency, session
and user grouping. No SDK, no decorators, no code changes beyond the URL.

This is the Sentro **proxy mode**. It is OpenAI- and Anthropic-compatible and
forwards every field transparently to the real upstream provider, so it works
with any SDK that lets you override the base URL (OpenAI, Anthropic, LangChain,
LlamaIndex, Vercel AI SDK, raw `fetch`, etc.).

---

## How it works

```
Your app  ──▶  Sentro Proxy  ──▶  OpenAI / Anthropic / Groq / OpenRouter / …
                    │
                    └──▶  LlmCall captured in your Sentro project
```

1. You point your LLM client at `https://<your-sentro>/api/v1/proxy` instead of
   `https://api.openai.com` (or similar).
2. You add two headers: your **Sentro DSN** and (optionally) the real provider
   URL if it's not OpenAI.
3. Sentro forwards the request, captures the response + token usage + cost,
   and returns the upstream response unchanged.

Streaming (`stream: true`) is fully supported — the proxy passes the SSE stream
through byte-for-byte and extracts usage from the final `message_delta` /
final OpenAI chunk.

---

## Endpoints

| Endpoint                                  | Compatible with                        |
| ----------------------------------------- | -------------------------------------- |
| `POST /api/v1/proxy/chat/completions`     | OpenAI, Groq, Mistral, OpenRouter, …   |
| `POST /api/v1/proxy/messages`             | Anthropic `/v1/messages`               |

Both accept the same request/response schema as their upstream counterpart.

---

## Headers

| Header                    | Required | Default                     | Purpose                                      |
| ------------------------- | -------- | --------------------------- | -------------------------------------------- |
| `X-Sentro-DSN`            | yes\*    | —                           | Your Sentro project DSN token                |
| `Authorization: Bearer …` | yes\*    | —                           | Provider API key (or DSN, see note below)    |
| `X-Provider-Key`          | no       | falls back to `Authorization` | Explicit real provider key                 |
| `X-Provider-URL`          | no       | `https://api.openai.com` / `https://api.anthropic.com` | Real provider base URL |
| `X-Sentro-Session-ID`     | no       | —                           | Group calls into a session                   |
| `X-Sentro-User-Id`        | no       | —                           | Attribute a call to an end user              |

\* If you only send `Authorization: Bearer <sentro-dsn>` and no
`X-Provider-Key`, the proxy will use the DSN as both auth and the upstream
API key — useful in rare cases where your DSN is also the upstream key, but
normally you want to send both.

**Recommended pattern:** `X-Sentro-DSN` for Sentro auth, `Authorization: Bearer`
(or `x-api-key` for Anthropic) for the provider key. This is what the examples
below do.

---

## Quickstart

### Python — OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/api/v1/proxy",
    api_key="sk-...your-openai-key...",
    default_headers={
        "X-Sentro-DSN": "your-sentro-dsn-token",
        "X-Provider-URL": "https://api.openai.com",
        # Optional grouping
        "X-Sentro-Session-Id": "sess_abc123",
        "X-Sentro-User-Id": "user_42",
    },
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)
```

That's it. The call now shows up in your Sentro dashboard with tokens, cost,
and latency captured.

### TypeScript — OpenAI SDK

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/api/v1/proxy",
  apiKey: process.env.OPENAI_API_KEY!,
  defaultHeaders: {
    "X-Sentro-DSN": process.env.SENTRO_DSN!,
    "X-Provider-URL": "https://api.openai.com",
    "X-Sentro-Session-Id": "sess_abc123",
    "X-Sentro-User-Id": "user_42",
  },
});

const resp = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Python — Anthropic SDK

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:3000/api/v1/proxy",
    api_key="sk-ant-...your-anthropic-key...",
    default_headers={
        "X-Sentro-DSN": "your-sentro-dsn-token",
        "X-Provider-URL": "https://api.anthropic.com",
    },
)

resp = client.messages.create(
    model="claude-3-5-sonnet-latest",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.content[0].text)
```

### TypeScript — Anthropic SDK

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:3000/api/v1/proxy",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: {
    "X-Sentro-DSN": process.env.SENTRO_DSN!,
    "X-Provider-URL": "https://api.anthropic.com",
  },
});

const resp = await client.messages.create({
  model: "claude-3-5-sonnet-latest",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Other OpenAI-compatible providers

Just change `X-Provider-URL`:

| Provider    | `X-Provider-URL`                 |
| ----------- | -------------------------------- |
| Groq        | `https://api.groq.com/openai`    |
| Mistral     | `https://api.mistral.ai`         |
| OpenRouter  | `https://openrouter.ai/api`      |
| Together    | `https://api.together.xyz`       |
| Local Ollama| `http://localhost:11434`         |

The proxy appends `/v1/chat/completions` (or `/v1/messages`) to whatever URL
you set — same as the upstream convention.

### Streaming

Streaming works transparently. Just set `stream: true` as you would normally:

```python
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Count to 10"}],
    stream=True,
    stream_options={"include_usage": True},  # recommended for accurate cost
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

For OpenAI we recommend `stream_options={"include_usage": True}` so the final
chunk carries the authoritative token count. Anthropic streams always include
usage in the terminal `message_delta` event, no extra flag needed.

---

## Session & user grouping

Set these headers on any call to roll calls up in the Sentro UI:

- `X-Sentro-Session-Id: sess_…` — groups calls into a session (e.g. one chat
  conversation, one agent run).
- `X-Sentro-User-Id: user_…` — attributes the call to an end user so you can
  filter by user, compute per-user cost, etc.

Both are optional and free-form strings. Set whichever you have.

---

## Caveats

- **Pricing is estimated client-side.** The proxy uses a built-in model→price
  table to compute `cost` per call. This is necessarily a snapshot and will go
  stale as providers change prices. If you need exact billing numbers, treat
  Sentro's cost as a planning estimate.
- **The proxy is a dependency in your request path.** If it goes down, your
  LLM calls go down. Run it on infra you trust; for production, run Sentro
  near your LLM calls and keep timeouts sane.
- **Request bodies are logged.** Messages and system prompts are captured by
  default. If your prompts contain PII, make sure your Sentro instance is
  within your trust boundary.
- **Only `/chat/completions` and `/messages` are proxied.** Embeddings,
  fine-tuning, assistants, etc. aren't captured. Add them if you need them.

---

## Local development

```bash
# Point at your local Sentro
export SENTRO_BASE=http://localhost:3000/api/v1/proxy

# Use any OpenAI / Anthropic SDK with base_url = $SENTRO_BASE and you're done.
```

Check the Sentro dashboard at `http://localhost:3000` — your calls should
appear within ~1 second (the ingestion buffer flushes on a 1s timer).
