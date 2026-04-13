import WebhookForm from "@/components/webhook-form";

interface NewWebhookPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function NewWebhookPage({ params }: NewWebhookPageProps) {
  const { projectId } = await params;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">New Webhook</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Receive HTTP POST requests when events occur in your project.
        </p>
      </div>

      <WebhookForm projectId={projectId} />
    </div>
  );
}
