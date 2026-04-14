# Sentro Python SDK

**Error tracking and agent observability for AI agents.** Zero dependencies.

Sentro is an open-source Sentry alternative built specifically for AI agents. This SDK gives you full observability into your agent runs — every step, tool call, LLM call, token count, and cost.

## Install

```bash
pip install sentro-sdk
```

## Quick Start

### Error tracking

```python
from sentro import Sentro

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")

try:
    do_something()
except Exception as e:
    sentro.capture_exception(e)
```

### Agent observability

```python
from sentro import Sentro

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")

with sentro.trace("order-processor", goal="Process refund #456") as run:
    with run.trace("Looking up order") as step:
        # Track tool calls
        with step.trace_tool_call("db.query", input={"sql": "SELECT 1"}) as tool:
            result = db.query("SELECT 1")
            tool.set_result(result)

        # Track LLM calls
        llm = step.llm_call(model="claude-sonnet-4-6")
        response = call_llm("Approve refund?")
        llm.end(prompt_tokens=150, completion_tokens=20, cost=0.001)
# Auto-ends on exit, auto-errors on exception
```

### Async support

```python
async with sentro.trace("async-agent", goal="Async task") as run:
    async with run.trace("Step 1") as step:
        result = await some_async_work()
```

## Features

- **Zero dependencies** — standard library only, works in any Python 3.10+ environment
- **Context managers** — `with` blocks for automatic lifecycle management
- **Async support** — `async with` for async frameworks
- **Auto error capture** — exceptions automatically mark runs as failed
- **Batched transport** — events are batched and sent efficiently
- **Run tracing** — full agent execution timeline
- **Step replay** — ordered reasoning chain with tool and LLM call details
- **Cost tracking** — token counts and cost per LLM call

## Configuration

```python
sentro = Sentro(
    dsn="http://token@localhost:3000/api/ingest/proj_1",
    default_tags={"env": "production", "version": "1.0.0"},
)
```

## Security Considerations

- The `capture_prompts` option is disabled by default to avoid storing LLM prompt/response bodies that may contain PII
- DSN tokens are API keys — treat them like passwords, don't commit them to source control  
- Tool call inputs/outputs are stored as-is — avoid passing sensitive data (API keys, passwords) through traced tool calls

## Framework Integrations

### LangChain

```python
from sentro import Sentro
from sentro.integrations.langchain import SentroMiddleware

sentro = Sentro(dsn="YOUR_DSN")

agent = create_agent(
    model="gpt-4o",
    tools=[...],
    middleware=[SentroMiddleware(sentro)],
)
```

Requires `pip install langchain langgraph`.

### CrewAI

```python
from sentro import Sentro
from sentro.integrations.crewai import SentroCrewListener

sentro = Sentro(dsn="YOUR_DSN")
SentroCrewListener(sentro)  # auto-registers — just kick off your crew
```

Requires `pip install crewai`.

## Links

- **GitHub:** [github.com/yzzztech/sentro](https://github.com/yzzztech/sentro)
- **Docs:** Available at `/docs` when running Sentro
- **TypeScript SDK:** `npm install @sentro/sdk`

## License

MIT
