import { prisma } from "@/lib/db/prisma";
import DatasetsTable from "@/components/datasets-table";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function DatasetsPage({ params }: Props) {
  const { projectId } = await params;

  const datasets = await prisma.dataset.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  const tableDatasets = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    itemCount: d._count.items,
    updatedAt: d.updatedAt,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Datasets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Test fixtures for regression testing</p>
        </div>
      </div>
      <DatasetsTable datasets={tableDatasets} projectId={projectId} />
    </div>
  );
}
