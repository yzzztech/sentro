import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { provider, model, messages, temperature, apiKey, systemPrompt } = body;

  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }
  if (!model || !Array.isArray(messages)) {
    return NextResponse.json({ error: "model and messages required" }, { status: 400 });
  }

  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          temperature,
        }),
      });
      const data = await res.json();
      return NextResponse.json({
        status: res.status,
        provider: "anthropic",
        response: data,
        content: data.content?.[0]?.text ?? null,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
              totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : null,
      });
    }

    // Default to OpenAI-compatible
    const baseUrl = body.baseUrl ?? "https://api.openai.com";
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
    });
    const data = await res.json();
    return NextResponse.json({
      status: res.status,
      provider: provider ?? "openai",
      response: data,
      content: data.choices?.[0]?.message?.content ?? null,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Provider call failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
