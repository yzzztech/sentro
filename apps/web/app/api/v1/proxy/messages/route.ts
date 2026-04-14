import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";
import crypto from "crypto";

startFlushTimer();

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const apiKeyHeader = req.headers.get("x-api-key");

  const sentroDsn = req.headers.get("x-sentro-dsn") || bearerToken;
  const providerKey =
    req.headers.get("x-provider-key") || apiKeyHeader || sentroDsn;
  const providerUrl =
    req.headers.get("x-provider-url") || "https://api.anthropic.com";
  const anthropicVersion =
    req.headers.get("anthropic-version") || "2023-06-01";
  const sessionId = req.headers.get("x-sentro-session-id");
  const userId = req.headers.get("x-sentro-user-id");

  if (!sentroDsn) {
    return NextResponse.json(
      { error: "X-Sentro-DSN header required" },
      { status: 401 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { dsnToken: sentroDsn },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Invalid Sentro DSN" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const model = typeof body.model === "string" ? body.model : "unknown";
  // Anthropic schema: top-level `system` (string) plus `messages` array.
  const messages = body.messages;
  const system = body.system;
  const isStreaming = body.stream === true;

  const runId = crypto.randomUUID();
  const stepId = crypto.randomUUID();
  const llmCallId = crypto.randomUUID();
  const startTime = new Date();

  addToBatch(sentroDsn, [
    {
      type: "run.start",
      runId,
      agent: "proxy",
      goal: "LLM proxy call",
      model,
      sessionId,
      userId,
      trigger: "proxy",
      timestamp: startTime.toISOString(),
    },
    {
      type: "step.start",
      stepId,
      runId,
      content: "LLM call via proxy (Anthropic)",
      timestamp: startTime.toISOString(),
    },
    {
      type: "llm_call.start",
      llmCallId,
      stepId,
      runId,
      model,
      provider: detectProvider(providerUrl),
      messages,
      system,
      temperature: body.temperature,
      timestamp: startTime.toISOString(),
    },
  ]);

  try {
    const upstreamRes = await fetch(`${providerUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": providerKey ?? "",
        "anthropic-version": anthropicVersion,
      },
      body: JSON.stringify(body),
    });

    if (isStreaming) {
      return handleAnthropicStream(upstreamRes, sentroDsn, {
        runId,
        stepId,
        llmCallId,
        model,
        startTime,
      });
    }

    const responseData = await upstreamRes.json();
    const endTime = new Date();
    const usage = responseData.usage as AnthropicUsage | undefined;
    const promptTokens = usage?.input_tokens ?? 0;
    const completionTokens = usage?.output_tokens ?? 0;

    // Extract first text block from content[] array as the logged response
    let responseContent: unknown = responseData.content;
    if (Array.isArray(responseData.content)) {
      const firstText = responseData.content.find(
        (c: { type?: string }) => c?.type === "text"
      );
      if (firstText) responseContent = firstText;
    }

    addToBatch(sentroDsn, [
      {
        type: "llm_call.end",
        llmCallId,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: estimateCost(model, promptTokens, completionTokens),
        response: responseContent,
        timestamp: endTime.toISOString(),
      },
      {
        type: "step.end",
        stepId,
        timestamp: endTime.toISOString(),
      },
      {
        type: "run.end",
        runId,
        status: upstreamRes.ok ? "success" : "failure",
        timestamp: endTime.toISOString(),
      },
    ]);

    return NextResponse.json(responseData, { status: upstreamRes.status });
  } catch (err) {
    const endTime = new Date();
    addToBatch(sentroDsn, [
      {
        type: "llm_call.end",
        llmCallId,
        timestamp: endTime.toISOString(),
      },
      { type: "step.end", stepId, timestamp: endTime.toISOString() },
      {
        type: "run.end",
        runId,
        status: "failure",
        errorMessage: err instanceof Error ? err.message : String(err),
        timestamp: endTime.toISOString(),
      },
    ]);
    return NextResponse.json(
      {
        error: "Proxy error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}

function detectProvider(url: string): string {
  if (url.includes("openai.com")) return "openai";
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("groq.com")) return "groq";
  if (url.includes("mistral.ai")) return "mistral";
  if (url.includes("openrouter.ai")) return "openrouter";
  return "unknown";
}

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Rough pricing per 1M tokens (input/output) — update as prices change
  const pricing: Record<string, [number, number]> = {
    "claude-3-5-sonnet": [3, 15],
    "claude-3-5-haiku": [0.8, 4],
    "claude-3-opus": [15, 75],
    "claude-3-haiku": [0.25, 1.25],
    "claude-opus-4": [15, 75],
    "claude-sonnet-4": [3, 15],
    "claude-haiku-4": [0.8, 4],
    "gpt-4o": [2.5, 10],
    "gpt-4o-mini": [0.15, 0.6],
  };
  const key =
    Object.keys(pricing).find((k) =>
      model.toLowerCase().includes(k.toLowerCase())
    ) ?? "";
  const [inputPrice, outputPrice] = pricing[key] ?? [0, 0];
  return (
    (promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000
  );
}

async function handleAnthropicStream(
  upstreamRes: Response,
  sentroDsn: string,
  ctx: {
    runId: string;
    stepId: string;
    llmCallId: string;
    model: string;
    startTime: Date;
  }
): Promise<Response> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = upstreamRes.body?.getReader();

  if (!reader) {
    return NextResponse.json({ error: "No stream body" }, { status: 502 });
  }

  // Anthropic SSE uses event types: message_start, message_delta (with usage
  // containing output_tokens), message_stop.  message_start includes initial
  // usage (input_tokens + partial output_tokens). Deltas overwrite output_tokens.
  let promptTokens = 0;
  let completionTokens = 0;

  (async () => {
    try {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              // message_start: { message: { usage: { input_tokens, output_tokens } } }
              if (
                chunk.type === "message_start" &&
                chunk.message?.usage
              ) {
                promptTokens =
                  chunk.message.usage.input_tokens ?? promptTokens;
                completionTokens =
                  chunk.message.usage.output_tokens ?? completionTokens;
              }
              // message_delta: { usage: { output_tokens } } — authoritative final count
              if (chunk.type === "message_delta" && chunk.usage) {
                if (typeof chunk.usage.input_tokens === "number") {
                  promptTokens = chunk.usage.input_tokens;
                }
                if (typeof chunk.usage.output_tokens === "number") {
                  completionTokens = chunk.usage.output_tokens;
                }
              }
            } catch {
              /* partial JSON — skip */
            }
          }
        }
      }
    } finally {
      writer.close();

      const endTime = new Date();
      addToBatch(sentroDsn, [
        {
          type: "llm_call.end",
          llmCallId: ctx.llmCallId,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: estimateCost(ctx.model, promptTokens, completionTokens),
          timestamp: endTime.toISOString(),
        },
        {
          type: "step.end",
          stepId: ctx.stepId,
          timestamp: endTime.toISOString(),
        },
        {
          type: "run.end",
          runId: ctx.runId,
          status: "success",
          timestamp: endTime.toISOString(),
        },
      ]);
    }
  })();

  return new Response(readable, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
