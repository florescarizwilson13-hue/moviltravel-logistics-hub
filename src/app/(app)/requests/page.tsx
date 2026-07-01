import { PageHeader } from "@/components/layout/page-header";
import { RequestsInbox } from "@/components/requests/requests-inbox";

export default function RequestsPage() {
  return (
    <>
      <PageHeader
        title="Solicitudes de traslado"
        description="Bandeja operativa para crear, completar y preparar traslados."
      />
      <RequestsInbox />
    </>
  );
}
