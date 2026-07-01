import { PageHeader } from "@/components/layout/page-header";
import { CreateRequestView } from "@/components/requests/create-request-view";

export default function NewRequestPage() {
  return (
    <>
      <PageHeader
        title="Ingresar solicitud recibida"
        description="Para solicitudes recibidas por teléfono, email, WhatsApp u otro canal."
      />
      <CreateRequestView />
    </>
  );
}
