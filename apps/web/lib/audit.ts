import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export interface AuditContext {
  userId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit log entry. Non-blocking — never throws from the caller's
 * perspective so audit failures can't brick a mutation.
 */
export async function logAudit(ctx: AuditContext): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
    } catch {
      // headers() not available outside a request context — fine, leave null
    }

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId ?? null,
        actorEmail: ctx.actorEmail ?? null,
        action: ctx.action,
        resource: ctx.resource,
        resourceId: ctx.resourceId ?? null,
        projectId: ctx.projectId ?? null,
        metadata: (ctx.metadata as never) ?? {},
        ip,
      },
    });
  } catch (err) {
    // Audit failures are logged but never thrown
    console.error("audit.log failed:", err);
  }
}
