import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import Nav from "@/components/nav";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-950">
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Projects</h1>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
          >
            New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-500 text-lg">No projects yet</p>
            <p className="text-gray-600 text-sm mt-1">
              Create your first project to start tracking errors and performance.
            </p>
            <Link
              href="/projects/new"
              className="inline-block mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/${project.id}/issues`}
                className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-100">{project.name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">{project.id}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
