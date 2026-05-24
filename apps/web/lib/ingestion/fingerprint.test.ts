import { describe, it, expect } from "vitest";
import { generateFingerprint } from "@/lib/ingestion/fingerprint";

describe("generateFingerprint", () => {
  it("uses explicit fingerprint field when provided", () => {
    const fp1 = generateFingerprint({
      fingerprint: "custom-key-123",
      message: "something else",
    });
    expect(fp1).toBeTypeOf("string");
    expect(fp1.length).toBe(16);

    // Same explicit fingerprint → same output
    const fp2 = generateFingerprint({
      fingerprint: "custom-key-123",
      message: "completely different",
    });
    expect(fp1).toBe(fp2);
  });

  it("uses message + top stack frame for errors with stackTrace", () => {
    const fp1 = generateFingerprint({
      message: "TypeError: cannot read property x",
      stack_trace:
        "at Object.foo (/app/index.js:10:5)\n    at bar (/app/lib.js:20:3)",
      level: "error",
    });

    const fp2 = generateFingerprint({
      message: "TypeError: cannot read property x",
      stack_trace:
        "at Object.foo (/app/index.js:10:5)\n    at different place (/app/x.js:99:1)",
      level: "error",
    });

    expect(fp1).toBe(fp2); // Same message + same top frame
    expect(fp1.length).toBe(16);
  });

  it("different messages produce different fingerprints", () => {
    const fp1 = generateFingerprint({
      message: "Error A",
      stack_trace: "at foo (bar.js:1)",
    });
    const fp2 = generateFingerprint({
      message: "Error B",
      stack_trace: "at foo (bar.js:1)",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("different top frames produce different fingerprints", () => {
    const fp1 = generateFingerprint({
      message: "Same error",
      stack_trace: "at frame1 (a.js:1)\n  at frame2 (b.js:2)",
    });
    const fp2 = generateFingerprint({
      message: "Same error",
      stack_trace: "at frame2 (b.js:2)\n  at frame1 (a.js:1)",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("uses level + message for plain messages without stack", () => {
    const fp1 = generateFingerprint({
      message: "hello world",
      level: "warning",
    });
    const fp2 = generateFingerprint({
      message: "hello world",
      level: "warning",
    });
    const fp3 = generateFingerprint({
      message: "hello world",
      level: "error",
    });

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3); // Different levels → different fingerprints
    expect(fp1.length).toBe(16);
  });

  it("defaults level to 'info' when not provided", () => {
    const fpExplicit = generateFingerprint({
      message: "test message",
      level: "info",
    });
    const fpDefault = generateFingerprint({
      message: "test message",
    });
    expect(fpExplicit).toBe(fpDefault);
  });

  it("falls back to JSON hash for events without message", () => {
    const fp = generateFingerprint({
      type: "custom",
      data: { foo: "bar" },
    });
    expect(fp).toBeTypeOf("string");
    expect(fp.length).toBe(16);
  });

  it("ignores empty string fingerprint", () => {
    // Empty string fingerprint should fall through to other methods
    const fp = generateFingerprint({
      fingerprint: "",
      message: "actual message",
    });
    expect(fp).toBeTypeOf("string");
    expect(fp.length).toBe(16);
  });

  it("ignores empty stack_trace", () => {
    // Empty stack should not use the stack path
    const fp1 = generateFingerprint({
      message: "test",
      stack_trace: "",
    });
    const fp2 = generateFingerprint({
      message: "test",
    });
    expect(fp1).toBe(fp2);
  });

  it("handles snake_case fields from Python SDK", () => {
    const fp1 = generateFingerprint({
      message: "test",
      stack_trace: "at foo (bar.py:1)",
      level: "error",
    });
    // Same data with camelCase field name should also work (but different field name)
    const fp2 = generateFingerprint({
      message: "test",
      stackTrace: "at foo (bar.py:1)",
      level: "error",
    });
    // stackTrace vs stack_trace — fingerprint uses stack_trace, so fingerprint will differ
    // because only stack_trace triggers the stack path
    expect(fp1).not.toBe(fp2); // fingerprint.ts only checks stack_trace, not stackTrace
  });
});
