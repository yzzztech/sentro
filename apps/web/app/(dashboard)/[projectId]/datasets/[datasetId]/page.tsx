import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import DatasetItems from "@/components/dataset-items";

interface Props {
  params: Promise<{ projectId: string; datasetId: string }>;
}

export default async function DatasetDetailPage({ params }: Props) {
  const { projectId, datasetId } = await params;

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: {
      items: { orderBy: { createdAt: "desc" }, take: 100 },
      _count: { select: { items: true } },
    },
  });

  if (!dataset) {
    return <div className="text-gray-500">Dataset not found.</div>;
  }

  return (
    <div>
      <Link
        href={`/${projectId}/datasets`}
        className="text-sm text-gray-400 hover:text-gray-200"
      >
        ← Back to datasets
      </Link>
      <h1 className="text-2xl font-bold text-gray-100 mt-2">{dataset.name}</h1>
      {dataset.description && (
        <p className="text-sm text-gray-400 mt-1">{dataset.description}</p>
      )}
      <div className="text-sm text-gray-500 mt-2">{dataset._count.items} items</div>
      <div className="mt-6">
        <DatasetItems
          items={dataset.items.map((i) => ({
            id: i.id,
            input: i.input,
            expectedOutput: i.expectedOutput,
            sourceRunId: i.sourceRunId,
            createdAt: i.createdAt,
          }))}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
