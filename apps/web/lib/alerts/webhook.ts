export async function deliverWebhook(url: string, payload: Record<string, unknown>): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return response.status;
  } catch {
    return null;
  }
}
