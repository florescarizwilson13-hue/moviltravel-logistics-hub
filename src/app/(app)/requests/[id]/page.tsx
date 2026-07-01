import { PageHeader } from "@/components/layout/page-header";
import { RequestDetailView } from "@/components/requests/request-detail-view";

export default async function RequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title="Detalle de solicitud"
        description="Revisión, completitud, preparación y asignación inicial."
      />
      <RequestDetailView requestId={id} />
    </>
  );
}
