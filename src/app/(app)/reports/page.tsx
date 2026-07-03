import { PageHeader } from "@/components/layout/page-header";
import { OperationalReports } from "@/components/reports/operational-reports";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Informes"
        description="Revisa traslados por fecha, conductor, empresa, estado y canal de ingreso."
      />
      <OperationalReports />
    </>
  );
}
