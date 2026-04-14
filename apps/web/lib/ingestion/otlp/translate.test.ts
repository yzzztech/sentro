import { describe, it, expect } from "vitest";
import { translateOtlp } from "./translate";
import type { OtlpTraceRequest } from "./types";

const sampleTrace: OtlpTraceRequest = {
  resourceSpans: [{
    resource: { attributes: [{ key: "service.name", value: { stringValue: "test-agent" } }] },
    scopeSpans: [{
      spans: [
        {
          traceId: "0af7651916cd43dd8448eb211c80319c",
          spanId: "b7ad6b7169203331",
          name: "agent-run",
          startTimeUnixNano: "1700000000000000000",
          endTimeUnixNano: "1700000001000000000",
          attributes: [],
        },
        {
          traceId: "0af7651916cd43dd8448eb211c80319c",
          spanId: "1234567890abcdef",
          parentSpanId: "b7ad6b7169203331",
          name: "llm-call",
          startTimeUnixNano: "1700000000100000000",
          endTimeUnixNano: "1700000000500000000",
          attributes: [
            { key: "gen_ai.system", value: { stringValue: "openai" } },
            { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
            { key: "gen_ai.usage.input_tokens", value: { intValue: "150" } },
            { key: "gen_ai.usage.output_tokens", value: { intValue: "50" } },
          ],
        },
      ],
    }],
  }],
};

describe("translateOtlp", () => {
  it("emits run.start for new traces", () => {
    const events = translateOtlp(sampleTrace);
    const runStart = events.find((e) => e.type === "run.start");
    expect(runStart).toBeDefined();
    expect(runStart?.agent).toBe("test-agent");
  });

  it("emits llm_call.end with token counts", () => {
    const events = translateOtlp(sampleTrace);
    const llmEnd = events.find((e) => e.type === "llm_call.end");
    expect(llmEnd).toBeDefined();
    expect(llmEnd?.promptTokens).toBe(150);
    expect(llmEnd?.completionTokens).toBe(50);
    expect(llmEnd?.totalTokens).toBe(200);
  });

  it("emits run.end when root span is present", () => {
    const events = translateOtlp(sampleTrace);
    const runEnd = events.find((e) => e.type === "run.end");
    expect(runEnd).toBeDefined();
    expect(runEnd?.status).toBe("success");
  });
});
