import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import IssuesTable from "@/components/issues-table";

interface IssuesPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}

const STATUS_OPTIONS = [
  { label: "Unresolved", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Ignored", value: "ignored" },
] as const;

export default async function IssuesPage({ params, searchParams }: IssuesPageProps) {
  const { projectId } = await params;
  const { status = "open" } = await searchParams;

  const validStatus = ["open", "resolved", "ignored"].includes(status) ? status : "open";

  const groups = await prisma.eventGroup.findMany({
    where: {
      projectId,
      status: validStatus as "open" | "resolved" | "ignored",
    },
    orderBy: { lastSeen: "desc" },
    include: {
      _count: {
        select: { events: true },
      },
    },
    take: 100,
  });

  // Count affected runs per group (events that have a runId)
  const groupIds = groups.map((g) => g.id);

  const runCounts: Record<string, number> =
    groupIds.length > 0
      ? await prisma.event
          .groupBy({
            by: ["groupId"],
            where: {
              groupId: { in: groupIds },
              runId: { not: null },
            },
            _count: { runId: true },
          })
          .then((rows) =>
            Object.fromEntries(rows.map((r) => [r.groupId, r._count.runId]))
          )
      : {};

  const issues = groups.map((g) => ({
    id: g.id,
    title: g.title,
    level: g.level,
    lastSeen: g.lastSeen,
    count: g.count,
    eventCount: g._count.events,
    affectedRunCount: runCounts[g.id] ?? 0,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Issues</h1>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {STATUS_OPTIONS.map(({ label, value }) => {
          const isActive = validStatus === value;
          return (
            <Link
              key={value}
              href={`/${projectId}/issues?status=${value}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <IssuesTable issues={issues} projectId={projectId} />
    </div>
  );
}
