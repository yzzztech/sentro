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
    <div className="min-h-screen bg-gray-950 flex">
      <Nav projectId={project.id} projectName={project.name} />
      <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
    </div>
  );
}
