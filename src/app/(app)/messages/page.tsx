import { PageHeader } from "@/components/layout/page-header";
import { MessagesHistory } from "@/components/messages/messages-history";

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Historial operativo de WhatsApp preparados para copiar y enviar manualmente."
      />
      <MessagesHistory />
    </>
  );
}
