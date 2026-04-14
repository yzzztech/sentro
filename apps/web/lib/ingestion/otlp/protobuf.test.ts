import { describe, it, expect } from "vitest";
import protobuf from "protobufjs";
import { decodeOtlpProtobuf } from "./protobuf";
import { otlpTraceSchema } from "./proto-schema";
import { translateOtlp } from "./translate";

const root = protobuf.Root.fromJSON(otlpTraceSchema as unknown as protobuf.INamespace);
const RequestType = root.lookupType(
  "opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest"
);

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

describe("decodeOtlpProtobuf", () => {
  it("round-trips a minimal trace request through protobuf bytes", () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c";
    const spanId = "b7ad6b7169203331";
    const childSpanId = "1234567890abcdef";

    const source = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "otel-agent" } }],
          },
          scopeSpans: [
            {
              scope: { name: "test-scope", version: "1.0" },
              spans: [
                {
                  traceId: hexToBytes(traceId),
                  spanId: hexToBytes(spanId),
                  name: "agent-run",
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000001000000000",
                },
                {
                  traceId: hexToBytes(traceId),
                  spanId: hexToBytes(childSpanId),
                  parentSpanId: hexToBytes(spanId),
                  name: "llm-call",
                  startTimeUnixNano: "1700000000100000000",
                  endTimeUnixNano: "1700000000500000000",
                  attributes: [
                    { key: "gen_ai.system", value: { stringValue: "openai" } },
                    { key: "gen_ai.usage.input_tokens", value: { intValue: 150 } },
                    { key: "gen_ai.usage.output_tokens", value: { intValue: 50 } },
                  ],
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    const buf = RequestType.encode(RequestType.create(source)).finish();
    const decoded = decodeOtlpProtobuf(new Uint8Array(buf));

    expect(decoded.resourceSpans).toHaveLength(1);
    const rs = decoded.resourceSpans[0];
    expect(rs.resource?.attributes?.[0]?.key).toBe("service.name");
    expect(rs.resource?.attributes?.[0]?.value.stringValue).toBe("otel-agent");

    const spans = rs.scopeSpans[0].spans;
    expect(spans).toHaveLength(2);
    expect(spans[0].traceId).toBe(traceId);
    expect(spans[0].spanId).toBe(spanId);
    expect(spans[1].parentSpanId).toBe(spanId);

    const tokens = spans[1].attributes?.find((a) => a.key === "gen_ai.usage.input_tokens");
    expect(tokens?.value.intValue).toBe("150");

    // Verify it plugs into the existing translator end-to-end
    const events = translateOtlp(decoded);
    const llmEnd = events.find((e) => e.type === "llm_call.end");
    expect(llmEnd?.promptTokens).toBe(150);
    expect(llmEnd?.completionTokens).toBe(50);
  });

  it("returns empty resourceSpans for an empty payload", () => {
    const buf = RequestType.encode(RequestType.create({})).finish();
    const decoded = decodeOtlpProtobuf(new Uint8Array(buf));
    expect(decoded.resourceSpans).toEqual([]);
  });
});
