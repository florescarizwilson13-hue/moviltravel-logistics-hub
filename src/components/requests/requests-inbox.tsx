"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { TRANSFER_REQUEST_STATUS_LABELS } from "@/lib/constants/statuses";
import {
  getTransferRequestDisplaySummary,
  getTransferRequestCompleteness,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type { TransferRequest, TransferRequestStatus } from "@/types";
import { RequestStatusBadge } from "./request-status-badge";

type StatusFilter = "all" | "incomplete" | "pending_review" | "ready_to_assign" | "assigned";

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "Todas", value: "all" },
  { label: "Incompletas", value: "incomplete" },
  { label: "Pendientes de revisión", value: "pending_review" },
  { label: "Listas para asignar", value: "ready_to_assign" },
  { label: "Traslado asignado", value: "assigned" }
];

export function RequestsInbox() {
  const { store, error, isRefreshing, isReady } = useLocalLogisticsStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredRequests = useMemo(() => {
    if (!store) {
      return [];
    }

    if (statusFilter === "all") {
      return sortRequestsByLatestActivity(store.requests);
    }

    return sortRequestsByLatestActivity(
      store.requests.filter((request) => request.status === statusFilter)
    );
  }, [statusFilter, store]);

  if (!isReady || !store) {
    if (error) {
      return (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      );
    }

    return <section className="rounded-lg border bg-card p-4 text-sm">Cargando solicitudes...</section>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {isRefreshing
              ? "Actualizando solicitudes..."
              : `${filteredRequests.length} de ${store.requests.length} solicitudes`}
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ingresar solicitud
        </Link>
      </div>

      <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["incomplete", "pending_review", "ready_to_assign", "assigned"] as TransferRequestStatus[]).map(
          (status) => (
            <button
              key={status}
              type="button"
              className="rounded-lg border bg-white p-3 text-left hover:bg-muted"
              onClick={() => setStatusFilter(status as StatusFilter)}
            >
              <p className="text-xs text-muted-foreground">{TRANSFER_REQUEST_STATUS_LABELS[status]}</p>
              <p className="mt-1 text-2xl font-semibold">
                {store.requests.filter((request) => request.status === status).length}
              </p>
            </button>
          )
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`h-9 rounded-md border px-3 text-sm font-medium ${
              statusFilter === filter.value
                ? "border-primary bg-sky-50 text-primary"
                : "border-input bg-white hover:bg-muted"
            }`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[1fr_140px_170px_110px] border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Solicitud</span>
          <span>Fecha y hora</span>
          <span>Estado</span>
          <span>Faltantes</span>
        </div>
        <div className="divide-y">
          {filteredRequests.map((request) => {
            const completeness = getTransferRequestCompleteness(request);
            const missingLabels = completeness.missingFields.map(
              (field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field
            );
            const summary = getTransferRequestDisplaySummary(request);
            const sourceLabel = getRequestSourceLabel(request);
            const passengerCountLabel = getPassengerCountLabel(request);
            const companyLine = [
              summary.company,
              passengerCountLabel,
              request.requesterName ? `Solicitante: ${request.requesterName}` : null
            ].filter(Boolean);
            const phoneLine = [
              request.passengerPhone ? `Pasajero: ${request.passengerPhone}` : null,
              request.requesterPhone ? `Contacto: ${request.requesterPhone}` : null
            ].filter(Boolean);

            return (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className="grid gap-3 px-4 py-3 text-sm hover:bg-muted/60 md:grid-cols-[1fr_140px_170px_110px]"
              >
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{summary.passenger}</span>
                    {sourceLabel ? (
                      <span className="ml-2 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        {sourceLabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-muted-foreground">{companyLine.join(" · ")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {summary.origin} → {summary.destination}
                  </p>
                  {phoneLine.length > 0 ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {phoneLine.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-muted-foreground">
                  <p>{summary.date}</p>
                  <p>{summary.time}</p>
                </div>
                <div>
                  <RequestStatusBadge status={request.status} />
                </div>
                <div className="text-xs">
                  {missingLabels.length > 0 ? (
                    <span className="font-medium text-amber-700">{missingLabels.length} datos</span>
                  ) : (
                    <span className="font-medium text-emerald-700">Completa</span>
                  )}
                </div>
              </Link>
            );
          })}
          {filteredRequests.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay solicitudes en este estado. Usa Ingresar solicitud recibida para registrar una nueva.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function sortRequestsByLatestActivity<T extends { createdAt: string; updatedAt: string }>(
  requests: T[]
) {
  return [...requests].sort((first, second) =>
    getRequestSortDate(second).localeCompare(getRequestSortDate(first))
  );
}

function getRequestSortDate(request: { createdAt: string; updatedAt: string }) {
  return request.updatedAt || request.createdAt;
}

function getRequestSourceLabel(request: { metadata?: Record<string, unknown> | null }) {
  return request.metadata?.source === "twilio_whatsapp_sandbox" ? "WhatsApp" : null;
}

function getPassengerCountLabel(request: TransferRequest) {
  if (!request.passengerCount) {
    return null;
  }

  return `${request.passengerCount} ${
    request.passengerCount === 1 ? "pasajero" : "pasajeros"
  }`;
}
