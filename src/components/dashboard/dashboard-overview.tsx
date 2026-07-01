"use client";

import Link from "next/link";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { TRANSFER_REQUEST_STATUS_LABELS } from "@/lib/constants/statuses";

export function DashboardOverview() {
  const { store, repositories, error, isReady, isRefreshing } = useLocalLogisticsStore();

  if (!isReady || !store || isRefreshing) {
    return <section className="rounded-lg border bg-card p-4 text-sm">Cargando panel operativo...</section>;
  }

  const overview = repositories.dashboard.getOverview(store);
  const metrics = [
    ["Solicitudes abiertas", overview.metrics.openRequests],
    ["Incompletas", overview.metrics.incomplete],
    ["Pendientes de revisión", overview.metrics.pendingReview],
    ["Listas para asignar", overview.metrics.readyToAssign],
    ["Traslados asignados", overview.metrics.assigned],
    ["WhatsApp preparados", overview.metrics.generatedMessages],
    ["Conductores activos", overview.metrics.activeDrivers]
  ] as const;

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">Canales de ingreso</h3>
          <Link
            href="/operacion"
            className="inline-flex h-9 items-center rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted"
          >
            Ver guía operativa
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link
            href="/ai-capture"
            className="rounded-lg border bg-white p-4 text-sm hover:bg-muted"
          >
            <p className="font-semibold">IA / WhatsApp</p>
            <p className="mt-2 text-muted-foreground">
              Capturar solicitud desde mensaje del cliente
            </p>
          </Link>
          <Link
            href="/requests/new"
            className="rounded-lg border bg-white p-4 text-sm hover:bg-muted"
          >
            <p className="font-semibold">Coordinadora</p>
            <p className="mt-2 text-muted-foreground">
              Ingresar solicitud recibida por teléfono o email
            </p>
          </Link>
          <Link
            href="/solicitar"
            className="rounded-lg border bg-white p-4 text-sm hover:bg-muted"
          >
            <p className="font-semibold">Formulario público</p>
            <p className="mt-2 text-muted-foreground">Link para solicitud directa del cliente</p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h3 className="font-medium">Atención requerida</h3>
        {overview.attentionRequests.length > 0 ? (
          <div className="mt-4 divide-y rounded-lg border">
            {overview.attentionRequests.map((request) => (
              <article key={request.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{request.passenger}</p>
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">
                      {TRANSFER_REQUEST_STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{request.company}</p>
                  <p className="mt-2 text-sm">
                    {request.date} · {request.time}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.origin} → {request.destination}
                  </p>
                  {request.missingFields.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.missingFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link
                  href={`/requests/${request.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
                >
                  Abrir solicitud
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay solicitudes incompletas, pendientes de revisión o listas para asignar.
          </p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h3 className="font-medium">Últimos WhatsApp preparados</h3>
          {overview.latestMessages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {overview.latestMessages.map((messageGroup) => (
                <article key={messageGroup.requestId} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{messageGroup.title}</p>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      {messageGroup.pendingMessages} por enviar · {messageGroup.sentMessages} enviados
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">{messageGroup.route}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Último WhatsApp preparado: {formatDashboardDate(messageGroup.latestCreatedAt)}
                  </p>
                  <Link
                    href={`/requests/${messageGroup.requestId}`}
                    className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Abrir solicitud
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Aún no hay WhatsApp preparados. Se crearán al asignar conductores.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h3 className="font-medium">Conductores disponibles</h3>
          {overview.activeDrivers.length > 0 ? (
            <div className="mt-4 space-y-3">
              {overview.activeDrivers.map((driver) => (
                <article key={driver.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{driver.fullName}</p>
                  <p className="mt-1 text-muted-foreground">{driver.phone}</p>
                  <p className="mt-2">
                    {driver.vehicleName} · {driver.vehiclePlate} · Capacidad {driver.vehicleCapacity}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay conductores activos. Activa o crea uno desde Conductores.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
