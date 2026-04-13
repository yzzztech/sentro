# Sentro Integrations

Framework integrations for automatic agent observability with Sentro.

## Available Integrations

### Python

| Framework | Package | Status |
|-----------|---------|--------|
| **LangChain** | `from sentro.integrations.langchain import SentroMiddleware` | Built-in |
| **CrewAI** | `from sentro.integrations.crewai import SentroCrewListener` | Built-in |

### TypeScript

| Framework | Package | Status |
|-----------|---------|--------|
| **Vercel AI SDK** | `@sentro/vercel-ai` | Experimental |

### Agent Platforms

| Platform | Integration | Status |
|----------|------------|--------|
| **Claude Code** | Shell hook (SessionStart, PreToolUse, PostToolUse, Stop) | Available |
| **OpenClaw** | SKILL.md skill | Available |

## Quick Start

### LangChain
```python
from sentro import Sentro
from sentro.integrations.langchain import SentroMiddleware

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")
middleware = SentroMiddleware(sentro)

agent = create_agent(model="gpt-4o", tools=[...], middleware=[middleware])
```

### CrewAI
```python
from sentro import Sentro
from sentro.integrations.crewai import SentroCrewListener

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")
listener = SentroCrewListener(sentro)
# Auto-registers — just kick off your crew
```

### Claude Code
```bash
# 1. Set your DSN
export SENTRO_DSN="http://token@localhost:3000/api/ingest/proj_1"

# 2. Copy the hook
cp packages/integrations/claude-code/sentro-hook.sh ~/.claude/hooks/sentro-hook.sh
chmod +x ~/.claude/hooks/sentro-hook.sh

# 3. Add hooks to ~/.claude/settings.json (see packages/integrations/claude-code/README.md)
```

### OpenClaw
Install the Sentro skill:
```bash
pip install sentro-sdk
export SENTRO_DSN="http://token@localhost:3000/api/ingest/proj_1"
```
Copy `packages/integrations/openclaw/SKILL.md` to your OpenClaw skills directory.

### Vercel AI SDK
```typescript
import { Sentro } from '@sentro/sdk';
import { sentroMiddleware } from '@sentro/vercel-ai';

const sentro = new Sentro({ dsn: '...' });

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
  experimental_telemetry: sentroMiddleware(sentro),
});
```

## GitHub
https://github.com/yzzztech/sentro
