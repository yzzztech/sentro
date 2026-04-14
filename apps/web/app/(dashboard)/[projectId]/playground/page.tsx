import PlaygroundClient from "@/components/playground-client";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ model?: string; runId?: string; llmCallId?: string }>;
}

export default async function PlaygroundPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const search = await searchParams;

  // If llmCallId is provided, load it from the DB
  let preset = null;
  if (search.llmCallId) {
    const { prisma } = await import("@/lib/db/prisma");
    const llm = await prisma.llmCall.findFirst({
      where: { id: search.llmCallId, projectId },
    });
    if (llm) {
      preset = {
        model: llm.model,
        provider: llm.provider,
        messages: llm.messages,
        temperature: llm.temperature,
      };
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Playground</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit and re-run LLM calls interactively</p>
        </div>
      </div>
      <PlaygroundClient projectId={projectId} preset={preset} />
    </div>
  );
}
