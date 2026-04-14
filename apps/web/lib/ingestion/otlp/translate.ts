import type { OtlpTraceRequest, OtlpSpan } from "./types";
import { flattenAttributes, pickString, pickNumber } from "./attributes";
import { uuidFromHex, normalizeHex } from "./ids";

type IngestEvent = Record<string, unknown>;

const NANOS_PER_MS = 1_000_000;

function nanoToIso(nano: string | number): string {
  const n = typeof nano === "string" ? BigInt(nano) : BigInt(Math.floor(nano));
  const ms = Number(n / BigInt(NANOS_PER_MS));
  return new Date(ms).toISOString();
}

type SpanKind = "llm" | "tool" | "step" | "root";

function classifySpan(span: OtlpSpan, attrs: Record<string, unknown>): SpanKind {
  // OpenInference convention
  const oiKind = pickString(attrs, "openinference.span.kind");
  if (oiKind === "LLM" || oiKind === "CHAIN") return "llm";
  if (oiKind === "TOOL") return "tool";
  if (oiKind === "AGENT") return "root";

  // Has any gen_ai.* or llm.* → LLM
  const hasGenAi = Object.keys(attrs).some((k) => k.startsWith("gen_ai.") || k.startsWith("llm."));
  if (hasGenAi) return "llm";

  // Has tool.name / function.name → tool
  if (attrs["tool.name"] || attrs["function.name"] || attrs["tool.function.name"]) return "tool";

  // No parent → root; otherwise step
  return span.parentSpanId ? "step" : "root";
}

export function translateOtlp(req: OtlpTraceRequest): IngestEvent[] {
  const events: IngestEvent[] = [];
  const seenRuns = new Set<string>();

  for (const rs of req.resourceSpans ?? []) {
    const resourceAttrs = flattenAttributes(rs.resource?.attributes);
    const serviceName = pickString(resourceAttrs, "service.name") ?? "otlp-agent";

    for (const ss of rs.scopeSpans ?? []) {
      for (const span of ss.spans ?? []) {
        const spanAttrs = flattenAttributes(span.attributes);
        const traceHex = normalizeHex(span.traceId);
        const spanHex = normalizeHex(span.spanId);
        const parentHex = span.parentSpanId ? normalizeHex(span.parentSpanId) : null;

        const runId = uuidFromHex(traceHex);
        const sentroSpanId = uuidFromHex(spanHex);
        const parentSentroId = parentHex ? uuidFromHex(parentHex) : null;

        const startTime = nanoToIso(span.startTimeUnixNano);
        const endTime = nanoToIso(span.endTimeUnixNano);

        // Ensure a run.start exists for this trace (emit once)
        if (!seenRuns.has(runId)) {
          seenRuns.add(runId);
          events.push({
            type: "run.start",
            runId,
            agent: serviceName,
            goal: span.name,
            model: pickString(spanAttrs, "gen_ai.request.model", "llm.model_name"),
            trigger: "otlp",
            timestamp: startTime,
            metadata: {
              otel_trace_id: traceHex,
              resource: resourceAttrs,
            },
          });
        }

        const kind = classifySpan(span, spanAttrs);
        const isError = span.status?.code === 2;

        if (kind === "root") {
          // Root span → close the run
          events.push({
            type: "run.end",
            runId,
            status: isError ? "failure" : "success",
            timestamp: endTime,
            errorMessage: isError ? span.status?.message : undefined,
          });
          continue;
        }

        if (kind === "llm") {
          // LLM call — needs a step as parent
          const stepId = parentSentroId ?? sentroSpanId + "-step";
          events.push({
            type: "step.start",
            stepId,
            runId,
            content: span.name,
            timestamp: startTime,
          });

          const llmCallId = sentroSpanId;
          events.push({
            type: "llm_call.start",
            llmCallId,
            stepId,
            runId,
            model: pickString(spanAttrs, "gen_ai.response.model", "gen_ai.request.model", "llm.model_name") ?? "unknown",
            provider: pickString(spanAttrs, "gen_ai.system", "llm.vendor", "llm.provider") ?? "unknown",
            messages: spanAttrs["llm.input_messages"] ?? spanAttrs["traceloop.entity.input"],
            temperature: pickNumber(spanAttrs, "gen_ai.request.temperature", "llm.request.temperature"),
            timestamp: startTime,
          });

          const promptTokens = pickNumber(spanAttrs,
            "gen_ai.usage.input_tokens", "gen_ai.usage.prompt_tokens",
            "llm.token_count.prompt", "llm.usage.prompt_tokens"
          ) ?? 0;
          const completionTokens = pickNumber(spanAttrs,
            "gen_ai.usage.output_tokens", "gen_ai.usage.completion_tokens",
            "llm.token_count.completion", "llm.usage.completion_tokens"
          ) ?? 0;

          events.push({
            type: "llm_call.end",
            llmCallId,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cost: pickNumber(spanAttrs, "gen_ai.usage.cost", "llm.cost.total") ?? 0,
            response: spanAttrs["llm.output_messages"] ?? spanAttrs["traceloop.entity.output"],
            timestamp: endTime,
          });

          events.push({ type: "step.end", stepId, timestamp: endTime });
          continue;
        }

        if (kind === "tool") {
          const stepId = parentSentroId ?? sentroSpanId + "-step";
          events.push({
            type: "step.start",
            stepId,
            runId,
            content: span.name,
            timestamp: startTime,
          });

          const toolCallId = sentroSpanId;
          events.push({
            type: "tool_call.start",
            toolCallId,
            stepId,
            runId,
            toolName: pickString(spanAttrs, "tool.name", "function.name", "tool.function.name") ?? span.name,
            input: spanAttrs["tool.arguments"] ?? spanAttrs["function.arguments"] ?? {},
            timestamp: startTime,
          });
          events.push({
            type: "tool_call.end",
            toolCallId,
            output: spanAttrs["tool.result"] ?? spanAttrs["function.result"] ?? {},
            status: isError ? "error" : "success",
            errorMessage: isError ? span.status?.message : undefined,
            timestamp: endTime,
          });
          events.push({ type: "step.end", stepId, timestamp: endTime });
          continue;
        }

        // Step
        events.push({
          type: "step.start",
          stepId: sentroSpanId,
          runId,
          content: span.name,
          timestamp: startTime,
          metadata: spanAttrs,
        });
        events.push({ type: "step.end", stepId: sentroSpanId, timestamp: endTime });
      }
    }
  }

  return events;
}
