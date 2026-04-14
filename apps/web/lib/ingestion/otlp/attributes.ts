import type { OtlpAnyValue, OtlpKeyValue } from "./types";

export function valueOf(v: OtlpAnyValue | undefined): unknown {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue;
  if (v.intValue !== undefined) return Number(v.intValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.arrayValue) return v.arrayValue.values.map(valueOf);
  if (v.kvlistValue) {
    const obj: Record<string, unknown> = {};
    for (const kv of v.kvlistValue.values) obj[kv.key] = valueOf(kv.value);
    return obj;
  }
  return undefined;
}

export function flattenAttributes(attrs: OtlpKeyValue[] | undefined): Record<string, unknown> {
  if (!attrs) return {};
  const out: Record<string, unknown> = {};
  for (const kv of attrs) out[kv.key] = valueOf(kv.value);
  return out;
}

export function pickAttr(attrs: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (attrs[k] !== undefined) return attrs[k];
  }
  return undefined;
}

export function pickString(attrs: Record<string, unknown>, ...keys: string[]): string | null {
  const v = pickAttr(attrs, ...keys);
  return typeof v === "string" ? v : null;
}

export function pickNumber(attrs: Record<string, unknown>, ...keys: string[]): number | null {
  const v = pickAttr(attrs, ...keys);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  return null;
}
