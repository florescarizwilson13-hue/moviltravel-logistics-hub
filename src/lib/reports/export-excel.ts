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
  const worksheet = XLSX.utils.json_to_sheet(rows.map(normalizeExcelRow), { header: headers });
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 35 }
  ];
  worksheet["!autofilter"] = { ref: `A1:${columnLetter(headers.length - 1)}1` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  applyTextFormat(worksheet, rows.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Traslados");
  XLSX.writeFile(workbook, `informes-moviltravel-${getTodayForFilename()}.xlsx`, {
    bookType: "xlsx",
    compression: true
  });
}

function normalizeExcelRow(row: ExcelReportRow): ExcelReportRow {
  return {
    ...row,
    Fecha: normalizeChileanDateText(row.Fecha),
    Hora: normalizeTimeText(row.Hora)
  };
}

function normalizeChileanDateText(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return "";
  }

  const match = cleanValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return cleanValue;
  }

  const [, day, month, year] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function normalizeTimeText(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return "";
  }

  const match = cleanValue.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return cleanValue;
  }

  const [, hour, minute] = match;
  return `${hour.padStart(2, "0")}:${minute}`;
}

function applyTextFormat(worksheet: Record<string, unknown>, rowCount: number) {
  for (let rowIndex = 2; rowIndex <= rowCount + 1; rowIndex += 1) {
    setCellAsText(worksheet, `A${rowIndex}`);
    setCellAsText(worksheet, `B${rowIndex}`);
  }
}

function setCellAsText(worksheet: Record<string, unknown>, cellRef: string) {
  const cell = worksheet[cellRef] as { t?: string; z?: string } | undefined;

  if (!cell) {
    return;
  }

  cell.t = "s";
  cell.z = "@";
}

function columnLetter(index: number) {
  let column = "";
  let nextIndex = index;

  do {
    column = String.fromCharCode(65 + (nextIndex % 26)) + column;
    nextIndex = Math.floor(nextIndex / 26) - 1;
  } while (nextIndex >= 0);

  return column;
}

function getTodayForFilename() {
  return new Date().toISOString().slice(0, 10);
}
