import { PageHeader } from "@/components/layout/page-header";
import { DriversManager } from "@/components/drivers/drivers-manager";

export default function DriversPage() {
  return (
    <>
      <PageHeader
        title="Conductores"
        description="Registro de conductores y disponibilidad operativa."
      />
      <DriversManager />
    </>
  );
}
