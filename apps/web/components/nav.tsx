"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavProps {
  projectId?: string;
  projectName?: string;
}

interface NavItem {
  label: string;
  slug: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { label: "Issues", slug: "issues" },
      { label: "Agent Runs", slug: "runs" },
      { label: "Sessions", slug: "sessions" },
      { label: "Performance", slug: "performance" },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Scores", slug: "scores" },
      { label: "Datasets", slug: "datasets" },
      { label: "Playground", slug: "playground" },
    ],
  },
  {
    label: "Prompts",
    items: [{ label: "Prompts", slug: "prompts" }],
  },
  {
    label: "Ops",
    items: [
      { label: "Alerts", slug: "alerts" },
      { label: "Webhooks", slug: "webhooks" },
    ],
  },
];

export default function Nav({ projectId, projectName }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="w-56 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo + project */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <Link href="/projects" className="text-green-400 font-bold text-lg block">
          Sentro
        </Link>
        {projectName && (
          <div className="mt-2 text-xs text-gray-500 uppercase tracking-wider">Project</div>
        )}
        {projectName && (
          <div className="text-sm text-gray-200 font-medium truncate">{projectName}</div>
        )}
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {projectId ? (
          NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-2 text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                {group.label}
              </div>
              <div className="flex flex-col">
                {group.items.map(({ label, slug }) => {
                  const href = `/${projectId}/${slug}`;
                  const isActive =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={slug}
                      href={href}
                      className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-gray-800 text-gray-100 font-medium"
                          : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="px-2 text-sm text-gray-500">No project selected</div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-900 hover:text-gray-200 rounded-md transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
