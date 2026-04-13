import crypto from "crypto";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateFingerprint(event: Record<string, unknown>): string {
  // If explicit fingerprint field is provided, use it
  if (typeof event.fingerprint === "string" && event.fingerprint.length > 0) {
    return sha256hex(event.fingerprint).slice(0, 16);
  }

  // For errors with stack trace: hash message + top stack frame
  if (
    typeof event.message === "string" &&
    typeof event.stack_trace === "string" &&
    event.stack_trace.length > 0
  ) {
    const topFrame = event.stack_trace.split("\n")[0] ?? "";
    return sha256hex(`${event.message}${topFrame}`).slice(0, 16);
  }

  // For plain messages: hash level + message
  if (typeof event.message === "string") {
    const level = typeof event.level === "string" ? event.level : "info";
    return sha256hex(`${level}${event.message}`).slice(0, 16);
  }

  // Fallback: hash first 200 chars of JSON
  const jsonStr = JSON.stringify(event).slice(0, 200);
  return sha256hex(jsonStr).slice(0, 16);
}
