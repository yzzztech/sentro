import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";
import crypto from "crypto";

startFlushTimer();

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const sentroDsn = req.headers.get("x-sentro-dsn") || bearerToken;
  const providerKey = req.headers.get("x-provider-key") || sentroDsn;
  const providerUrl =
    req.headers.get("x-provider-url") || "https://api.openai.com";
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
  const messages = body.messages;
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
      content: "LLM call via proxy",
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
      temperature: body.temperature,
      timestamp: startTime.toISOString(),
    },
  ]);

  try {
    const upstreamRes = await fetch(`${providerUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerKey}`,
      },
      body: JSON.stringify(body),
    });

    if (isStreaming) {
      return handleStream(upstreamRes, sentroDsn, {
        runId,
        stepId,
        llmCallId,
        model,
        startTime,
      });
    }

    const responseData = await upstreamRes.json();
    const endTime = new Date();
    const usage = responseData.usage as OpenAIUsage | undefined;

    addToBatch(sentroDsn, [
      {
        type: "llm_call.end",
        llmCallId,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        cost: estimateCost(model, usage),
        response: responseData.choices?.[0]?.message,
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
  usage: OpenAIUsage | undefined
): number {
  if (!usage) return 0;
  // Rough pricing per 1M tokens (input/output) — update as prices change
  const pricing: Record<string, [number, number]> = {
    "gpt-4o": [2.5, 10],
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4-turbo": [10, 30],
    "gpt-3.5-turbo": [0.5, 1.5],
    "claude-3-5-sonnet": [3, 15],
    "claude-3-5-haiku": [0.8, 4],
    "claude-opus-4": [15, 75],
    "claude-sonnet-4": [3, 15],
  };
  const key =
    Object.keys(pricing).find((k) =>
      model.toLowerCase().includes(k.toLowerCase())
    ) ?? "";
  const [inputPrice, outputPrice] = pricing[key] ?? [0, 0];
  const prompt = usage.prompt_tokens ?? 0;
  const completion = usage.completion_tokens ?? 0;
  return (prompt * inputPrice + completion * outputPrice) / 1_000_000;
}

async function handleStream(
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

  let promptTokens = 0;
  let completionTokens = 0;
  let lastUsage: OpenAIUsage | null = null;

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
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.usage) {
                lastUsage = chunk.usage;
                promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
                completionTokens =
                  chunk.usage.completion_tokens ?? completionTokens;
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
          cost: estimateCost(
            ctx.model,
            lastUsage ?? {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
            }
          ),
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
