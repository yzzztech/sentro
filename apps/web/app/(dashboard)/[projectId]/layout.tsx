import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { validateSession } from "@/lib/auth/session";
import Nav from "@/components/nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Nav projectId={project.id} projectName={project.name} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
