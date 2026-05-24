/**
 * Next.js instrumentation hook — starts background workers on app startup.
 * Runs once when the server starts (not per-request, not at build time).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("./lib/jobs/worker");
    await startWorker();
    console.log("[instrumentation] background worker started");
  }
}
