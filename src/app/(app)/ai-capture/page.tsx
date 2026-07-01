import { PageHeader } from "@/components/layout/page-header";
import { AiCaptureWorkbench } from "@/components/ai-capture/ai-capture-workbench";

export default function AiCapturePage() {
  return (
    <>
      <PageHeader
        title="Captura desde WhatsApp"
        description="Ayuda para convertir mensajes de clientes en solicitudes de traslado."
      />
      <AiCaptureWorkbench />
    </>
  );
}
