import { redirect } from "next/navigation";
import Link from "next/link";
import { validateSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Nav from "@/components/nav";

interface Props {
  searchParams: Promise<{ action?: string; resource?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: Props) {
  const session = await validateSession();
  if (!session) redirect("/login");

  const { action, resource, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    userId: session.userId,
    ...(action ? { action } : {}),
    ...(resource ? { resource } : {}),
  };

  const [entries, total, distinctActions, distinctResources] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.auditLog.count({ where: { userId: session.userId } }),
    prisma.auditLog.findMany({
      where: { userId: session.userId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { userId: session.userId },
      distinct: ["resource"],
      select: { resource: true },
      orderBy: { resource: "asc" },
    }),
  ]);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Nav />
      <main className="flex-1 min-w-0 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Security-relevant events on your account: logins, API key changes,
            project create/update/delete.
          </p>
        </div>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action</label>
            <select
              name="action"
              defaultValue={action ?? ""}
              className="px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600 min-w-[160px]"
            >
              <option value="">All</option>
              {distinctActions.map((a) => (
                <option key={a.action} value={a.action}>{a.action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Resource</label>
            <select
              name="resource"
              defaultValue={resource ?? ""}
              className="px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600 min-w-[140px]"
            >
              <option value="">All</option>
              {distinctResources.map((r) => (
                <option key={r.resource} value={r.resource}>{r.resource}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md"
          >
            Filter
          </button>
          {(action || resource) && (
            <Link
              href="/settings/audit-log"
              className="px-3 py-1.5 border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm rounded-md"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/60 border-b border-gray-800">
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Time</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Action</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Resource</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">IP</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No entries.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-gray-100">{e.action}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {e.resource}
                    {e.resourceId && (
                      <span className="block text-xs text-gray-600 font-mono truncate max-w-[200px]">
                        {e.resourceId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                    {e.ip ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs font-mono break-all max-w-[340px]">
                    {Object.keys((e.metadata as object) ?? {}).length > 0
                      ? JSON.stringify(e.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            Page {page} of {maxPage} · {total.toLocaleString()} total
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...(action ? { action } : {}), ...(resource ? { resource } : {}), page: String(page - 1) }).toString()}`}
                className="px-3 py-1 border border-gray-700 rounded-md hover:bg-gray-800"
              >
                ← Prev
              </Link>
            )}
            {page < maxPage && (
              <Link
                href={`?${new URLSearchParams({ ...(action ? { action } : {}), ...(resource ? { resource } : {}), page: String(page + 1) }).toString()}`}
                className="px-3 py-1 border border-gray-700 rounded-md hover:bg-gray-800"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
