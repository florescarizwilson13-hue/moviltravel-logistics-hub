"use client";

import { Download, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import {
  TRANSFER_REQUEST_STATUSES,
  TRANSFER_REQUEST_STATUS_LABELS
} from "@/lib/constants/statuses";
import {
  formatDisplayName,
  normalizeChileanPhone,
  normalizeVehiclePlate
} from "@/lib/formatters/operational-data";
import type { Driver, TransferRequest, TransferRequestStatus } from "@/types";

type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  driverId: string;
  company: string;
  status: string;
  channel: string;
};

type ReportRow = {
  request: TransferRequest;
  driver: Driver | null;
  date: string;
  time: string;
  company: string;
  requesterName: string;
  requesterPhone: string;
  passengerName: string;
  passengerPhone: string;
  passengerCount: string;
  origin: string;
  destination: string;
  driverName: string;
  driverPhone: string;
  vehicleName: string;
  vehiclePlate: string;
  statusLabel: string;
  channel: string;
  notes: string;
};

const initialFilters: ReportFilters = {
  dateFrom: "",
  dateTo: "",
  driverId: "all",
  company: "all",
  status: "all",
  channel: "all"
};

export function OperationalReports() {
  const { store, error, isReady, isRefreshing } = useLocalLogisticsStore();
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<ReportFilters>(initialFilters);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const rows = useMemo(() => {
    if (!store) {
      return [];
    }

    return buildReportRows(store.requests, store.drivers);
  }, [store]);

  const companyOptions = useMemo(
    () => [...new Set(rows.map((row) => row.company).filter(Boolean))].sort(),
    [rows]
  );
  const channelOptions = useMemo(
    () => [...new Set(rows.map((row) => row.channel).filter(Boolean))].sort(),
    [rows]
  );
  const filteredRows = useMemo(
    () => filterRows(rows, activeFilters),
    [activeFilters, rows]
  );
  const summary = useMemo(() => buildReportSummary(filteredRows), [filteredRows]);

  if (!isReady || !store) {
    if (error) {
      return (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      );
    }

    return <section className="rounded-lg border bg-card p-4 text-sm">Cargando informes...</section>;
  }

  async function handleExport() {
    setExportNotice(null);
    setIsExporting(true);

    try {
      const { exportOperationalReportToExcel } = await import("@/lib/reports/export-excel");
      await exportOperationalReportToExcel(filteredRows.map(toExcelRow));
      setExportNotice(
        filteredRows.length > 0
          ? "Excel generado correctamente."
          : "Excel generado solo con encabezados porque no hay resultados."
      );
    } catch (caught) {
      setExportNotice(
        caught instanceof Error ? caught.message : "No se pudo generar el archivo Excel."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Filtros</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRefreshing
                ? "Actualizando datos..."
                : `${filteredRows.length} de ${rows.length} traslados en el informe.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-2 border border-input bg-white text-foreground hover:bg-muted"
              onClick={() => {
                setDraftFilters(initialFilters);
                setActiveFilters(initialFilters);
              }}
            >
              Limpiar filtros
            </Button>
            <Button type="button" className="gap-2" onClick={() => setActiveFilters(draftFilters)}>
              <Filter className="h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button type="button" className="gap-2" disabled={isExporting} onClick={handleExport}>
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <FilterField label="Fecha desde">
            <input
              type="date"
              className={fieldClass}
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))
              }
            />
          </FilterField>
          <FilterField label="Fecha hasta">
            <input
              type="date"
              className={fieldClass}
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))
              }
            />
          </FilterField>
          <FilterField label="Conductor">
            <select
              className={fieldClass}
              value={draftFilters.driverId}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, driverId: event.target.value }))
              }
            >
              <option value="all">Todos</option>
              {store.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {formatDisplayName(driver.fullName)}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Empresa">
            <select
              className={fieldClass}
              value={draftFilters.company}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, company: event.target.value }))
              }
            >
              <option value="all">Todas</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Estado">
            <select
              className={fieldClass}
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="all">Todos</option>
              {TRANSFER_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TRANSFER_REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Canal">
            <select
              className={fieldClass}
              value={draftFilters.channel}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, channel: event.target.value }))
              }
            >
              <option value="all">Todos</option>
              {channelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
        {exportNotice ? (
          <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {exportNotice}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <SummaryCard label="Total traslados" value={summary.total} />
        <SummaryCard label="Pendientes de revisión" value={summary.pendingReview} />
        <SummaryCard label="Listas para asignar" value={summary.readyToAssign} />
        <SummaryCard label="Asignados" value={summary.assigned} />
        <SummaryCard label="Finalizados" value={summary.completed} />
        <SummaryCard label="Incompletos" value={summary.incomplete} />
        <SummaryCard label="% asignados/finalizados" value={`${summary.assignedRate}%`} />
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium">Resultados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1600px] text-left text-sm">
            <thead className="bg-muted text-xs font-medium text-muted-foreground">
              <tr>
                {reportHeaders.map((header) => (
                  <th key={header} className="px-3 py-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((row) => (
                <tr key={row.request.id} className="align-top">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.time}</td>
                  <td className="px-3 py-2">{row.company}</td>
                  <td className="px-3 py-2">{row.requesterName}</td>
                  <td className="px-3 py-2">{row.requesterPhone}</td>
                  <td className="px-3 py-2 font-medium">{row.passengerName}</td>
                  <td className="px-3 py-2">{row.passengerPhone}</td>
                  <td className="px-3 py-2">{row.passengerCount}</td>
                  <td className="px-3 py-2">{row.origin}</td>
                  <td className="px-3 py-2">{row.destination}</td>
                  <td className="px-3 py-2">{row.driverName}</td>
                  <td className="px-3 py-2">{row.driverPhone}</td>
                  <td className="px-3 py-2">{row.vehicleName}</td>
                  <td className="px-3 py-2">{row.vehiclePlate}</td>
                  <td className="px-3 py-2">
                    <RequestStatusBadge status={row.request.status} />
                  </td>
                  <td className="px-3 py-2">{row.channel}</td>
                  <td className="px-3 py-2">{row.notes}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={reportHeaders.length} className="px-3 py-6 text-center text-muted-foreground">
                    No hay traslados para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const reportHeaders = [
  "Fecha",
  "Hora",
  "Empresa",
  "Solicitante",
  "Teléfono solicitante",
  "Pasajero",
  "Teléfono pasajero",
  "Pasajeros",
  "Origen",
  "Destino",
  "Conductor",
  "Teléfono conductor",
  "Vehículo",
  "Patente",
  "Estado",
  "Canal",
  "Observaciones"
];

function buildReportRows(requests: TransferRequest[], drivers: Driver[]): ReportRow[] {
  return [...requests]
    .sort((first, second) => getSortDate(second).localeCompare(getSortDate(first)))
    .map((request) => {
      const driver = drivers.find((item) => item.id === request.assignedDriverId) ?? null;

      return {
        request,
        driver,
        date: formatChileanDate(request.pickupDate),
        time: formatTime(request.pickupTime),
        company: request.companyName?.trim() || "Empresa pendiente",
        requesterName: request.requesterName ? formatDisplayName(request.requesterName) : "",
        requesterPhone: normalizeChileanPhone(request.requesterPhone) ?? "",
        passengerName: request.passengerName ? formatDisplayName(request.passengerName) : "",
        passengerPhone: normalizeChileanPhone(request.passengerPhone) ?? "",
        passengerCount: request.passengerCount?.toString() ?? "",
        origin: request.originAddress?.trim() ?? "",
        destination: request.destinationAddress?.trim() ?? "",
        driverName: driver ? formatDisplayName(driver.fullName) : "",
        driverPhone: driver ? normalizeChileanPhone(driver.phone) ?? "" : "",
        vehicleName: driver?.vehicleName ? formatDisplayName(driver.vehicleName) : "",
        vehiclePlate: normalizeVehiclePlate(driver?.vehiclePlate) ?? "",
        statusLabel: TRANSFER_REQUEST_STATUS_LABELS[request.status],
        channel: getRequestChannelLabel(request),
        notes: request.notes?.trim() ?? ""
      };
    });
}

function filterRows(rows: ReportRow[], filters: ReportFilters) {
  return rows.filter((row) => {
    if (filters.dateFrom && (row.request.pickupDate ?? "") < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && (row.request.pickupDate ?? "") > filters.dateTo) {
      return false;
    }

    if (filters.driverId !== "all" && row.request.assignedDriverId !== filters.driverId) {
      return false;
    }

    if (filters.company !== "all" && row.company !== filters.company) {
      return false;
    }

    if (filters.status !== "all" && row.request.status !== filters.status) {
      return false;
    }

    if (filters.channel !== "all" && row.channel !== filters.channel) {
      return false;
    }

    return true;
  });
}

function buildReportSummary(rows: ReportRow[]) {
  const total = rows.length;
  const assignedOrCompleted = rows.filter((row) =>
    ["assigned", "confirmed", "in_progress", "completed"].includes(row.request.status)
  ).length;

  return {
    total,
    pendingReview: countStatus(rows, "pending_review"),
    readyToAssign: countStatus(rows, "ready_to_assign"),
    assigned: countStatus(rows, "assigned"),
    completed: countStatus(rows, "completed"),
    incomplete: countStatus(rows, "incomplete"),
    assignedRate: total > 0 ? Math.round((assignedOrCompleted / total) * 100) : 0
  };
}

function countStatus(rows: ReportRow[], status: TransferRequestStatus) {
  return rows.filter((row) => row.request.status === status).length;
}

function toExcelRow(row: ReportRow) {
  return {
    Fecha: row.date,
    Hora: row.time,
    Empresa: row.company,
    Solicitante: row.requesterName,
    "Teléfono solicitante": row.requesterPhone,
    Pasajero: row.passengerName,
    "Teléfono pasajero": row.passengerPhone,
    "Cantidad pasajeros": row.passengerCount,
    Origen: row.origin,
    Destino: row.destination,
    Conductor: row.driverName,
    "Teléfono conductor": row.driverPhone,
    Vehículo: row.vehicleName,
    Patente: row.vehiclePlate,
    Estado: row.statusLabel,
    "Canal de ingreso": row.channel,
    Observaciones: row.notes
  };
}

function getRequestChannelLabel(request: TransferRequest) {
  if (request.metadata?.source === "twilio_whatsapp_sandbox") {
    return "WhatsApp";
  }

  return "Manual";
}

function getSortDate(request: TransferRequest) {
  return request.pickupAt ?? request.pickupDate ?? request.updatedAt ?? request.createdAt;
}

function formatChileanDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatTime(value: string | null | undefined) {
  return value?.slice(0, 5) ?? "";
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
