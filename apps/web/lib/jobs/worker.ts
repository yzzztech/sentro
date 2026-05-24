import PgBoss from "pg-boss";
import { runAlertCheck } from "./alert-check";
import { runCleanup } from "./cleanup";

let boss: PgBoss | null = null;

export async function startWorker(): Promise<void> {
  if (boss) return;

  try {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
    });

    boss.on("error", (err) => {
      console.error("[pg-boss] error:", err);
    });

    await boss.start();
    console.log("[pg-boss] started, running migrations...");

    // Create queues first (required in pg-boss v10+)
    await boss.createQueue("alert-check");
    await boss.createQueue("cleanup");

    // Schedule alert check every minute
    await boss.schedule("alert-check", "* * * * *");

    // Schedule cleanup daily at 3am
    await boss.schedule("cleanup", "0 3 * * *");

    // Register alert-check worker
    await boss.work("alert-check", async () => {
      try {
        await runAlertCheck();
      } catch (err) {
        console.error("[alert-check] job failed:", err);
        throw err;
      }
    });

    // Register cleanup worker
    await boss.work("cleanup", async () => {
      try {
        await runCleanup();
      } catch (err) {
        console.error("[cleanup] job failed:", err);
        throw err;
      }
    });

    console.log("[pg-boss] worker started — alert-check every 1m, cleanup daily at 3am");
  } catch (err) {
    console.error("[pg-boss] failed to start worker:", err);
    boss = null;
    // Don't crash the app — worker is optional for basic error tracking
  }
}

export async function stopWorker(): Promise<void> {
  if (boss) {
    try {
      await boss.stop();
    } catch (err) {
      console.error("[pg-boss] error stopping:", err);
    }
    boss = null;
  }
}
