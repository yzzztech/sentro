import { prisma } from "@/lib/db/prisma";
import PromptsTable from "@/components/prompts-table";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function PromptsPage({ params }: Props) {
  const { projectId } = await params;

  const prompts = await prisma.prompt.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { versions: true } },
    },
  });

  const tablePrompts = prompts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    latestVersion: p.versions[0]?.version ?? 0,
    latestTags: p.versions[0]?.tags ?? [],
    versionCount: p._count.versions,
    updatedAt: p.updatedAt,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Prompts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Version-controlled prompts for your agents</p>
        </div>
      </div>
      <PromptsTable prompts={tablePrompts} projectId={projectId} />
    </div>
  );
}
