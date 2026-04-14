"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavProps {
  projectId?: string;
  projectName?: string;
}

const PROJECT_TABS = [
  { label: "Issues", slug: "issues" },
  { label: "Agent Runs", slug: "runs" },
  { label: "Sessions", slug: "sessions" },
  { label: "Prompts", slug: "prompts" },
  { label: "Playground", slug: "playground" },
  { label: "Datasets", slug: "datasets" },
  { label: "Scores", slug: "scores" },
  { label: "Performance", slug: "performance" },
  { label: "Alerts", slug: "alerts" },
  { label: "Webhooks", slug: "webhooks" },
] as const;

export default function Nav({ projectId, projectName }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <Link href="/projects" className="text-green-400 font-bold text-lg shrink-0">
            Sentro
          </Link>

          {/* Project name badge */}
          {projectName && (
            <>
              <span className="text-gray-600">/</span>
              <span className="text-gray-300 font-medium text-sm">{projectName}</span>
            </>
          )}

          {/* Project tabs */}
          {projectId && (
            <div className="flex items-center gap-1 ml-2">
              {PROJECT_TABS.map(({ label, slug }) => {
                const href = `/${projectId}/${slug}`;
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={slug}
                    href={href}
                    className={`px-3 py-4 text-sm font-medium transition-colors border-b-2 ${
                      isActive
                        ? "border-purple-500 text-gray-100"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
