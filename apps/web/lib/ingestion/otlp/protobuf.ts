import protobuf from "protobufjs";
import { otlpTraceSchema } from "./proto-schema";
import type { OtlpTraceRequest, OtlpResourceSpans, OtlpScopeSpans, OtlpSpan, OtlpKeyValue, OtlpAnyValue } from "./types";

type ProtoAnyValue = {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: bigint | number | string | { toString(): string };
  doubleValue?: number;
  arrayValue?: { values?: ProtoAnyValue[] };
  kvlistValue?: { values?: ProtoKeyValue[] };
  bytesValue?: Uint8Array;
};

type ProtoKeyValue = { key: string; value?: ProtoAnyValue };

type ProtoSpan = {
  traceId?: Uint8Array | number[];
  spanId?: Uint8Array | number[];
  parentSpanId?: Uint8Array | number[];
  name?: string;
  kind?: number;
  startTimeUnixNano?: bigint | number | string | { toString(): string };
  endTimeUnixNano?: bigint | number | string | { toString(): string };
  attributes?: ProtoKeyValue[];
  status?: { code?: number; message?: string };
};

type ProtoScopeSpans = {
  scope?: { name?: string; version?: string };
  spans?: ProtoSpan[];
};

type ProtoResourceSpans = {
  resource?: { attributes?: ProtoKeyValue[] };
  scopeSpans?: ProtoScopeSpans[];
};

type ProtoRequest = { resourceSpans?: ProtoResourceSpans[] };

let cachedType: protobuf.Type | null = null;

function getRequestType(): protobuf.Type {
  if (!cachedType) {
    const root = protobuf.Root.fromJSON(otlpTraceSchema as unknown as protobuf.INamespace);
    cachedType = root.lookupType(
      "opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest"
    );
  }
  return cachedType;
}

function bytesToHex(bytes: Uint8Array | number[] | undefined): string {
  if (!bytes || bytes.length === 0) return "";
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function toNumericString(v: bigint | number | string | { toString(): string } | undefined): string {
  if (v === undefined) return "0";
  if (typeof v === "string") return v;
  return v.toString();
}

function convertAnyValue(v: ProtoAnyValue | undefined): OtlpAnyValue {
  if (!v) return {};
  const out: OtlpAnyValue = {};
  if (v.stringValue !== undefined) out.stringValue = v.stringValue;
  if (v.boolValue !== undefined) out.boolValue = v.boolValue;
  if (v.intValue !== undefined) out.intValue = toNumericString(v.intValue);
  if (v.doubleValue !== undefined) out.doubleValue = v.doubleValue;
  if (v.arrayValue) out.arrayValue = { values: (v.arrayValue.values ?? []).map(convertAnyValue) };
  if (v.kvlistValue) out.kvlistValue = { values: (v.kvlistValue.values ?? []).map(convertKeyValue) };
  return out;
}

function convertKeyValue(kv: ProtoKeyValue): OtlpKeyValue {
  return { key: kv.key, value: convertAnyValue(kv.value) };
}

function convertSpan(span: ProtoSpan): OtlpSpan {
  return {
    traceId: bytesToHex(span.traceId),
    spanId: bytesToHex(span.spanId),
    parentSpanId: span.parentSpanId && span.parentSpanId.length > 0 ? bytesToHex(span.parentSpanId) : undefined,
    name: span.name ?? "",
    kind: span.kind,
    startTimeUnixNano: toNumericString(span.startTimeUnixNano),
    endTimeUnixNano: toNumericString(span.endTimeUnixNano),
    attributes: (span.attributes ?? []).map(convertKeyValue),
    status: span.status ? { code: span.status.code, message: span.status.message } : undefined,
  };
}

function convertScopeSpans(ss: ProtoScopeSpans): OtlpScopeSpans {
  return {
    scope: ss.scope ? { name: ss.scope.name, version: ss.scope.version } : undefined,
    spans: (ss.spans ?? []).map(convertSpan),
  };
}

function convertResourceSpans(rs: ProtoResourceSpans): OtlpResourceSpans {
  return {
    resource: rs.resource ? { attributes: (rs.resource.attributes ?? []).map(convertKeyValue) } : undefined,
    scopeSpans: (rs.scopeSpans ?? []).map(convertScopeSpans),
  };
}

export function decodeOtlpProtobuf(bytes: Uint8Array): OtlpTraceRequest {
  const type = getRequestType();
  const message = type.decode(bytes);
  // oneofs:true + defaults:false ensures only the *set* oneof field is present
  // (e.g. AnyValue returns { intValue: "150" }, not all fields with defaults)
  const decoded = type.toObject(message, { oneofs: true, defaults: false, longs: String, bytes: Array }) as unknown as ProtoRequest;
  return {
    resourceSpans: (decoded.resourceSpans ?? []).map(convertResourceSpans),
  };
}
