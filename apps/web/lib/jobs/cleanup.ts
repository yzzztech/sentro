import { prisma } from "@/lib/db/prisma";

export async function runCleanup(): Promise<void> {
  const projects = await prisma.project.findMany({
    select: { id: true, retentionDays: true },
  });

  for (const project of projects) {
    try {
      const cutoff = new Date(
        Date.now() - project.retentionDays * 24 * 60 * 60 * 1000
      );

      // Delete old events
      await prisma.event.deleteMany({
        where: {
          projectId: project.id,
          receivedAt: { lt: cutoff },
        },
      });

      // Find old agent runs
      const oldRuns = await prisma.agentRun.findMany({
        where: {
          projectId: project.id,
          startedAt: { lt: cutoff },
        },
        select: { id: true },
      });

      if (oldRuns.length > 0) {
        const runIds = oldRuns.map((r) => r.id);

        // Delete dependent records first
        await prisma.toolCall.deleteMany({ where: { runId: { in: runIds } } });
        await prisma.llmCall.deleteMany({ where: { runId: { in: runIds } } });
        await prisma.step.deleteMany({ where: { runId: { in: runIds } } });
        await prisma.agentRun.deleteMany({ where: { id: { in: runIds } } });
      }

      // Delete old alert history
      await prisma.alertHistory.deleteMany({
        where: {
          projectId: project.id,
          triggeredAt: { lt: cutoff },
        },
      });
    } catch (err) {
      console.error(`Cleanup failed for project ${project.id}:`, err);
    }
  }
}
