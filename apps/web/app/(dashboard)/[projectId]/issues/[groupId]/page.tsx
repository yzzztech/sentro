import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

interface IssueDetailPageProps {
  params: Promise<{ projectId: string; groupId: string }>;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "bg-red-500/20 text-red-400 border border-red-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  debug: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { projectId, groupId } = await params;

  const group = await prisma.eventGroup.findFirst({
    where: { id: groupId, projectId },
    include: {
      events: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!group) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[group.level] ?? LEVEL_COLORS.error}`}
          >
            {group.level}
          </span>
          <span className="text-xs text-gray-500 capitalize">{group.status}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-100 mb-3 break-words">{group.title}</h1>
        <div className="flex flex-wrap gap-6 text-sm text-gray-400">
          <div>
            <span className="text-gray-500">First seen: </span>
            <span className="text-gray-300">{formatTimestamp(group.firstSeen)}</span>
          </div>
          <div>
            <span className="text-gray-500">Last seen: </span>
            <span className="text-gray-300">{formatTimestamp(group.lastSeen)}</span>
          </div>
          <div>
            <span className="text-gray-500">Total events: </span>
            <span className="text-red-400 font-medium">{group.count.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Events list */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Recent Events ({group.events.length})
      </h2>

      {group.events.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
          <p className="text-gray-500">No events recorded</p>
        </div>
      ) : (
        <div className="space-y-3">
          {group.events.map((event) => {
            const tags = event.tags as Record<string, string> | null;
            const tagEntries = tags ? Object.entries(tags) : [];

            return (
              <div
                key={event.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[event.level] ?? LEVEL_COLORS.error}`}
                  >
                    {event.level}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                <p className="text-gray-200 text-sm font-mono mb-3 break-words">
                  {event.message}
                </p>

                {event.stackTrace && (
                  <pre className="text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words mb-3 font-mono">
                    {event.stackTrace}
                  </pre>
                )}

                {tagEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tagEntries.map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700"
                      >
                        {k}: <span className="text-gray-300">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
