# Sentro Integrations — Plug and Play

One-line install for every supported platform. Set your `SENTRO_DSN` and you're live.

## Get Your DSN

Open your Sentro dashboard → Projects → create a new project → copy the DSN.

Format: `http://TOKEN@HOST:PORT/api/ingest/PROJECT_ID`

---

## One-Line Installs

### Claude Code

```bash
curl -fsSL https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/claude-code/install.sh | bash -s -- "YOUR_DSN"
```

Automatically captures every Claude Code session: tool calls, session start/stop, failures.

### OpenClaw

```bash
curl -fsSL https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/openclaw/install.sh | bash -s -- "YOUR_DSN"
```

Installs the Sentro observability skill and the `sentro-sdk` Python package.

### LangChain (Python)

```bash
pip install sentro-sdk
```

```python
from sentro import Sentro
from sentro.integrations.langchain import SentroMiddleware

sentro = Sentro(dsn="YOUR_DSN")
agent = create_agent(model="gpt-4o", tools=[...], middleware=[SentroMiddleware(sentro)])
```

### CrewAI

```bash
pip install sentro-sdk
```

```python
from sentro import Sentro
from sentro.integrations.crewai import SentroCrewListener

sentro = Sentro(dsn="YOUR_DSN")
SentroCrewListener(sentro)  # Auto-registers — just kick off your crew
```

### Vercel AI SDK

```bash
npm install @sentro/sdk
```

```typescript
import { Sentro } from '@sentro/sdk';
import { sentroMiddleware } from '@sentro/vercel-ai';

const sentro = new Sentro({ dsn: 'YOUR_DSN' });

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
  experimental_telemetry: sentroMiddleware(sentro),
});
```

---

## Full Matrix

| Platform | Type | Install |
|----------|------|---------|
| **Claude Code** | Shell hook | One-line installer |
| **OpenClaw** | SKILL.md + Python SDK | One-line installer |
| **LangChain** | Python middleware | `pip install sentro-sdk` |
| **CrewAI** | Python event listener | `pip install sentro-sdk` |
| **Vercel AI SDK** | TypeScript middleware | `npm install @sentro/sdk` |

## What Gets Captured (Every Integration)

- Every agent run with goal, model, duration, and status
- Each reasoning step in sequence
- Tool calls with inputs, outputs, and latency
- LLM calls with model, tokens, cost, and latency
- Errors with full stack traces

## Uninstall

### Claude Code
```bash
rm ~/.claude/hooks/sentro-hook.sh
# Then edit ~/.claude/settings.json to remove Sentro hook entries
```

### OpenClaw
```bash
rm -rf ~/.openclaw/skills/sentro-observability
```

### Python / TypeScript
```bash
pip uninstall sentro-sdk
# or
npm uninstall @sentro/sdk
```

---

**GitHub:** https://github.com/yzzztech/sentro
