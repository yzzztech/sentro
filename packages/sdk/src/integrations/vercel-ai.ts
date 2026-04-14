/**
 * Sentro integration for Vercel AI SDK.
 *
 * Usage:
 *   import { Sentro } from '@sentro/sdk';
 *   import { sentroMiddleware } from '@sentro/sdk/vercel-ai';
 *
 *   const sentro = new Sentro({ dsn: '...' });
 *
 *   const result = await generateText({
 *     model: openai('gpt-4o'),
 *     prompt: 'Hello!',
 *     experimental_telemetry: sentroMiddleware(sentro),
 *   });
 */

import type { Sentro } from '../client';

interface TelemetrySettings {
  isEnabled: boolean;
  functionId?: string;
  metadata?: Record<string, string>;
  tracer?: {
    startSpan: (name: string, options?: Record<string, unknown>) => Span;
  };
}

interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

interface SentroMiddlewareOptions {
  agentName?: string;
}

export function sentroMiddleware(
  client: Sentro,
  options: SentroMiddlewareOptions = {}
): TelemetrySettings {
  const agentName = options.agentName ?? 'vercel-ai-agent';

  return {
    isEnabled: true,
    functionId: agentName,
    tracer: {
      startSpan(name: string, spanOptions?: Record<string, unknown>) {
        const attributes: Record<string, string | number> = {};

        const span: Span = {
          setAttribute(key: string, value: string | number | boolean) {
            attributes[key] = String(value);

            // Capture LLM call data when available
            if (key === 'ai.model.id') {
              const step = (client as any)._currentStep;
              if (step) {
                const llm = step.llmCall({ model: String(value) });
                (span as any)._llmCall = llm;
              }
            }

            if (key === 'ai.usage.promptTokens' && (span as any)._llmCall) {
              (span as any)._promptTokens = Number(value);
            }

            if (key === 'ai.usage.completionTokens' && (span as any)._llmCall) {
              (span as any)._completionTokens = Number(value);
            }
          },

          setStatus(status: { code: number; message?: string }) {
            attributes['status.code'] = status.code;
            if (status.message) attributes['status.message'] = status.message;
          },

          end() {
            const llmCall = (span as any)._llmCall;
            if (llmCall) {
              llmCall.end({
                promptTokens: (span as any)._promptTokens,
                completionTokens: (span as any)._completionTokens,
              });
            }
          },
        };

        return span;
      },
    },
  };
}
