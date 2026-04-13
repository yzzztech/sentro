import { prisma } from "@/lib/db/prisma";
import { deliverWebhook } from "./webhook";

interface AlertConfig {
  threshold: number;
  windowMinutes: number;
  agentName?: string;
}

export async function evaluateAlertRules(): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
  });

  for (const rule of rules) {
    try {
      const config = rule.config as AlertConfig;
      const { threshold, windowMinutes } = config;
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

      let triggered = false;
      let triggeredValue = 0;

      if (rule.type === "error_spike") {
        const count = await prisma.event.count({
          where: {
            projectId: rule.projectId,
            level: "error",
            receivedAt: { gte: windowStart },
          },
        });
        triggeredValue = count;
        triggered = count >= threshold;
      } else if (rule.type === "failure_rate") {
        const agentNameFilter = config.agentName
          ? { agentName: config.agentName }
          : {};

        const [total, failed] = await Promise.all([
          prisma.agentRun.count({
            where: {
              projectId: rule.projectId,
              startedAt: { gte: windowStart },
              ...agentNameFilter,
            },
          }),
          prisma.agentRun.count({
            where: {
              projectId: rule.projectId,
              startedAt: { gte: windowStart },
              status: "failure",
              ...agentNameFilter,
            },
          }),
        ]);

        const rate = total > 0 ? (failed / total) * 100 : 0;
        triggeredValue = rate;
        triggered = rate >= threshold;
      } else if (rule.type === "cost_threshold") {
        const agentNameFilter = config.agentName
          ? { agentName: config.agentName }
          : {};

        const result = await prisma.agentRun.aggregate({
          where: {
            projectId: rule.projectId,
            startedAt: { gte: windowStart },
            ...agentNameFilter,
          },
          _sum: { totalCost: true },
        });

        const totalCost = parseFloat(
          (result._sum.totalCost ?? 0).toString()
        );
        triggeredValue = totalCost;
        triggered = totalCost >= threshold;
      }

      if (triggered) {
        const payload: Record<string, unknown> = {
          ruleId: rule.id,
          ruleName: rule.name,
          projectId: rule.projectId,
          type: rule.type,
          triggeredAt: new Date().toISOString(),
          config,
          value: triggeredValue,
        };

        const webhookStatus = await deliverWebhook(rule.webhookUrl, payload);

        await prisma.$transaction([
          prisma.alertHistory.create({
            data: {
              ruleId: rule.id,
              projectId: rule.projectId,
              triggeredAt: new Date(),
              payload,
              webhookStatus,
            },
          }),
          prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          }),
        ]);
      }
    } catch (err) {
      console.error(`Failed to evaluate alert rule ${rule.id}:`, err);
    }
  }
}
