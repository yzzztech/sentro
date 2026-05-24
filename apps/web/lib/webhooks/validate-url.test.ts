import { describe, it, expect } from "vitest";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

describe("validateWebhookUrl", () => {
  it("rejects non-URL input", async () => {
    const result = await validateWebhookUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid URL");
  });

  it("rejects non-http/https protocols", async () => {
    const result = await validateWebhookUrl("ftp://example.com/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only http and https protocols are allowed");
  });

  it("rejects javascript: protocol", async () => {
    const result = await validateWebhookUrl("javascript:alert(1)");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only http and https protocols are allowed");
  });

  it("rejects localhost by name", async () => {
    const result = await validateWebhookUrl("http://localhost:3000/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Localhost URLs are not allowed");
  });

  it("rejects .localhost subdomains", async () => {
    const result = await validateWebhookUrl("http://api.localhost/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Localhost URLs are not allowed");
  });

  it("rejects 127.0.0.1 (loopback)", async () => {
    const result = await validateWebhookUrl("http://127.0.0.1:8080/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 10.x.x.x (private range)", async () => {
    const result = await validateWebhookUrl("http://10.0.0.1/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 172.16.x.x (private range)", async () => {
    const result = await validateWebhookUrl("http://172.16.0.1/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 172.31.x.x (end of private range)", async () => {
    const result = await validateWebhookUrl("http://172.31.255.255/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 192.168.x.x (private range)", async () => {
    const result = await validateWebhookUrl("http://192.168.1.1/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 169.254.x.x (link-local / AWS metadata)", async () => {
    const result = await validateWebhookUrl("http://169.254.169.254/latest/meta-data");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects 0.0.0.0", async () => {
    const result = await validateWebhookUrl("http://0.0.0.0/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects IPv6 loopback ::1", async () => {
    const result = await validateWebhookUrl("http://[::1]:3000/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects IPv6 unique local addresses (fc00::/7)", async () => {
    const result = await validateWebhookUrl("http://[fd12:3456:789a:1::1]/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("rejects IPv6 unique local (fc00::/7 - fc variant)", async () => {
    const result = await validateWebhookUrl("http://[fc00::1]/hook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or reserved IP");
  });

  it("allows valid public URLs", async () => {
    const result = await validateWebhookUrl("https://example.com/webhook");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("allows public URLs with paths and query strings", async () => {
    const result = await validateWebhookUrl(
      "https://example.com/api/v1/notify?secret=xyz"
    );
    expect(result.valid).toBe(true);
  });

  it("returns error for non-resolvable hostnames", async () => {
    const result = await validateWebhookUrl(
      "https://this-host-definitely-does-not-exist-123456.invalid/hook"
    );
    expect(result.valid).toBe(false);
    // Could be "Could not resolve hostname" or "private or reserved"
    // depending on DNS resolution timing
    expect(result.error).toBeDefined();
  });
});
