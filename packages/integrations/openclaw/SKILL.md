---
name: sentro-observability
description: Auto-instrument OpenClaw agent runs with Sentro error tracking and observability. Captures every tool call, LLM call, step, and error with full cost tracking.
---

# Sentro Observability for OpenClaw

When this skill is active, wrap all agent task execution with Sentro tracing to capture full observability data.

## Setup

The user must have Sentro running and the Python SDK installed:

```bash
pip install sentro-sdk
```

Set the Sentro DSN in your environment:

```bash
export SENTRO_DSN="http://token@your-sentro-host:3000/api/ingest/proj_xxx"
```

## Instructions

When executing any task, tool call, or LLM interaction:

1. **Initialize Sentro** at the start of each session:
   ```python
   import os
   from sentro import Sentro
   sentro = Sentro(dsn=os.environ.get("SENTRO_DSN", ""))
   ```

2. **Wrap task execution** in a Sentro trace:
   ```python
   with sentro.trace("openclaw-agent", goal=task_description) as run:
       with run.trace("execute-task") as step:
           # Your task execution here
           result = execute_task()
   ```

3. **Track tool calls** (file ops, shell commands, browser actions, API calls):
   ```python
   with step.trace_tool_call("shell.exec", input={"cmd": command}) as tool:
       output = run_command(command)
       tool.set_result({"output": output, "exit_code": 0})
   ```

4. **Track LLM calls** with token and cost data:
   ```python
   llm = step.llm_call(model=model_name)
   response = call_llm(messages)
   llm.end(
       prompt_tokens=response.usage.input_tokens,
       completion_tokens=response.usage.output_tokens,
       cost=calculated_cost
   )
   ```

5. **Capture errors** automatically — if an exception occurs inside a `with sentro.trace(...)` block, it is automatically captured and the run is marked as failed.

## What Gets Tracked

- Every agent run with goal, model, duration, and status
- Each reasoning step in sequence
- Tool calls with inputs, outputs, and latency
- LLM calls with model, tokens, cost, and latency
- Errors with full stack traces
- Total cost per run

## Dashboard

View all captured data at your Sentro dashboard — issues, agent runs, step replay, performance metrics, and cost tracking.

GitHub: https://github.com/yzzztech/sentro
