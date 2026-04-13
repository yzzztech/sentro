# Sentro Python SDK

Python SDK for [Sentro](https://sentro.dev) -- error tracking and agent observability. Zero external dependencies.

## Installation

```bash
pip install sentro-sdk
```

## Quick Start

```python
from sentro import Sentro

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")
```

## Error Tracking

```python
try:
    do_something()
except Exception as e:
    sentro.capture_exception(e)

sentro.capture_message("Deployment started", level="info")
sentro.set_tags({"service": "api", "env": "production"})
sentro.set_context({"user_id": "123"})
```

## Agent Observability

### Context Manager API (recommended)

```python
with sentro.trace("order-processor", goal="Process refund #456", model="claude-sonnet-4-6") as run:
    with run.trace("Looking up order") as step:
        with step.trace_tool_call("db.query", input={"sql": "SELECT 1"}) as tool:
            result = db.query("SELECT 1")
            tool.set_result(result)

        llm = step.llm_call(model="claude-sonnet-4-6")
        response = call_llm("Approve?")
        llm.end(prompt_tokens=150, completion_tokens=20)
```

Context managers automatically end on exit and record errors on exception.

### Explicit API

```python
run = sentro.start_run(agent="order-processor", goal="Process refund")

step = run.step("Looking up order details")
tool = step.tool_call("database.query", input={"sql": "SELECT * FROM orders"})
tool.end(result={"id": 456})

llm = step.llm_call(model="claude-sonnet-4-6", messages=[{"role": "user", "content": "Approve?"}])
llm.end(response="Yes", prompt_tokens=150, completion_tokens=20, cost=0.001)

step.end()
run.end(status="success")
```

## Configuration

```python
sentro = Sentro(
    dsn="http://token@localhost:3000/api/ingest/proj_1",
    capture_prompts=False,     # Set True to include LLM messages/responses
    flush_interval=1.0,        # Seconds between automatic flushes
    max_batch_size=100,        # Max events per batch
    default_tags={"service": "my-agent"},
)
```

## Shutdown

```python
sentro.flush()     # Flush remaining events
sentro.shutdown()  # Stop timer + flush
```

An `atexit` handler automatically flushes on interpreter exit.

## Full Documentation

See [sentro.dev/docs](https://sentro.dev/docs) for the complete documentation.
