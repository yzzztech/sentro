# Dataset Evaluations

Run your agent against a Sentro dataset and automatically score the results.

## Python

```python
from sentro import Sentro
from sentro.evaluators import exact_match, contains

sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")

def my_agent(input_data, expected):
    """Your agent logic — return dict with 'output' and optional 'run_id'."""
    with sentro.trace("my-agent", goal=str(input_data)) as run:
        # ... your agent does work ...
        output = some_llm_call(input_data)
        return {
            "output": output,
            "run_id": run.id,
        }

results = sentro.run_eval(
    dataset_name="order-classifier-tests",
    runner=my_agent,
    evaluator=exact_match,  # or contains, or regex_match("pattern")
    name="eval-2026-04-14",
)

for r in results["results"]:
    print(f"Item {r['item_id']}: scores = {r['scores']}")
```

## TypeScript

```typescript
import { Sentro } from '@sentro/sdk';

const sentro = new Sentro({ dsn: '...' });

async function myAgent(input: unknown, expected: unknown) {
  const run = sentro.startRun({ agent: 'my-agent', goal: JSON.stringify(input) });
  // ... your agent logic ...
  const output = await callLLM(input);
  await run.end({ status: 'success' });
  return { output, runId: run.id };
}

const results = await sentro.runEval(
  'order-classifier-tests',
  myAgent,
  {
    evaluator: Sentro.evaluators.exactMatch,
    name: 'eval-2026-04-14',
  }
);
```

## Built-in Evaluators

| Evaluator | Description |
|-----------|-------------|
| `exact_match` / `exactMatch` | 1.0 if outputs are structurally identical |
| `contains` | 1.0 if expected substring is in actual (case-insensitive) |
| `regex_match("pattern")` / `regexMatch(/pattern/)` | 1.0 if pattern matches |

## Custom Evaluators

Any function `(actual, expected) → number` works. LLM-as-judge examples:

```python
def llm_judge(actual, expected):
    response = call_judge_llm(f"Rate 0-1: is '{actual}' equivalent to '{expected}'?")
    return float(response.strip())

sentro.run_eval("my-dataset", my_agent, evaluator=llm_judge)
```
