type ExcelReportRow = {
  Fecha: string;
  Hora: string;
  Empresa: string;
  Solicitante: string;
  "Teléfono solicitante": string;
  Pasajero: string;
  "Teléfono pasajero": string;
  "Cantidad pasajeros": string;
  Origen: string;
  Destino: string;
  Conductor: string;
  "Teléfono conductor": string;
  Vehículo: string;
  Patente: string;
  Estado: string;
  "Canal de ingreso": string;
  Observaciones: string;
};

const headers: Array<keyof ExcelReportRow> = [
  "Fecha",
  "Hora",
  "Empresa",
  "Solicitante",
  "Teléfono solicitante",
  "Pasajero",
  "Teléfono pasajero",
  "Cantidad pasajeros",
  "Origen",
  "Destino",
  "Conductor",
  "Teléfono conductor",
  "Vehículo",
  "Patente",
  "Estado",
  "Canal de ingreso",
  "Observaciones"
];

export async function exportOperationalReportToExcel(rows: ExcelReportRow[]) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 30 },
    { wch: 30 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 34 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Traslados");
  XLSX.writeFile(workbook, `informes-moviltravel-${getTodayForFilename()}.xlsx`, {
    bookType: "xlsx",
    compression: true
  });
}

function getTodayForFilename() {
  return new Date().toISOString().slice(0, 10);
}
