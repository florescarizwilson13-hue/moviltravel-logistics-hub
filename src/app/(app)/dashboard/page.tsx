import { PageHeader } from "@/components/layout/page-header";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Panel operativo"
        description="Resumen operacional de solicitudes, asignaciones, mensajes y conductores."
      />
      <DashboardOverview />
    </>
  );
}
