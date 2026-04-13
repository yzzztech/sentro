# @sentro/sdk

**Error tracking and agent observability for AI agents.** TypeScript SDK for [Sentro](https://github.com/yzzztech/sentro).

Sentro is an open-source Sentry alternative built specifically for AI agents. This SDK gives you full observability into every run, step, tool call, and LLM call your agents make — plus traditional error tracking.

## Install

```bash
npm install @sentro/sdk
```

## Quick Start

### Error tracking

```typescript
import { Sentro } from '@sentro/sdk';

const sentro = new Sentro({ dsn: 'http://token@localhost:3000/api/ingest/proj_1' });

sentro.captureException(new Error('Payment failed'));
```

### Agent observability

```typescript
const result = await sentro.trace('order-processor', {
  goal: 'Process refund for order #456',
  model: 'claude-sonnet-4-6',
}, async (run) => {

  return await run.trace('Looking up order', async (step) => {
    // Track tool calls
    const order = await step.traceToolCall('database.query',
      { sql: 'SELECT * FROM orders WHERE id = 456' },
      async () => db.query('SELECT * FROM orders WHERE id = 456')
    );

    // Track LLM calls
    const llm = step.llmCall({ model: 'claude-sonnet-4-6' });
    const decision = await callLLM('Should we approve this refund?');
    llm.end({ promptTokens: 150, completionTokens: 20, cost: 0.001 });

    return decision;
  });
});
// Automatically captures: duration, tokens, cost, success/failure
```

### Explicit API

For more control, use the explicit start/end API:

```typescript
const run = sentro.startRun({
  agent: 'research-agent',
  goal: 'Find recent papers',
  model: 'gpt-4o',
  trigger: 'api',
});

try {
  const step = run.step('Search for papers');
  const llm = step.llmCall({ model: 'gpt-4o', provider: 'openai' });
  const res = await openai.chat.completions.create({ ... });
  await llm.end({
    promptTokens: res.usage?.prompt_tokens,
    completionTokens: res.usage?.completion_tokens,
  });
  await step.end();
  await run.end({ status: 'success' });
} catch (err) {
  await run.error(err instanceof Error ? err : new Error(String(err)));
  throw err;
}
```

## Configuration

```typescript
const sentro = new Sentro({
  dsn: 'http://token@localhost:3000/api/ingest/proj_1',
  capturePrompts: false,      // set true to store prompt/response bodies
  flushIntervalMs: 1000,      // batch send every 1s
  maxBatchSize: 100,           // flush when buffer hits 100
  defaultTags: {
    env: 'production',
    version: '1.0.0',
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | string | required | Full DSN URL from your project settings |
| `capturePrompts` | boolean | `false` | Store prompt/response bodies verbatim |
| `flushIntervalMs` | number | `1000` | How often (ms) to flush the buffer |
| `maxBatchSize` | number | `100` | Max events per batch before immediate flush |
| `defaultTags` | Record\<string, string\> | — | Tags merged into every event |

## Security Considerations

- Set `capturePrompts: false` (the default) to avoid storing LLM prompt/response bodies that may contain PII
- DSN tokens are API keys — treat them like passwords, don't commit them to source control
- Tool call inputs/outputs are stored as-is — avoid passing sensitive data (API keys, passwords) through traced tool calls

## Graceful Shutdown

```typescript
// Before process exit
await sentro.shutdown();

// In serverless environments
await sentro.flush();
```

## Links

- **GitHub:** [github.com/yzzztech/sentro](https://github.com/yzzztech/sentro)
- **Docs:** Available at `/docs` when running Sentro
- **Python SDK:** `pip install sentro-sdk`

## License

MIT
