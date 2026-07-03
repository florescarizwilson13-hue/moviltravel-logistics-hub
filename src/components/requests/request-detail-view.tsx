"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  getTransferRequestDisplaySummary,
  getTransferRequestCompleteness,
  getTransferRequestPrimaryActionLabel,
  getTransferRequestReviewText,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type { CreateTransferRequestInput, Driver, RequestMessage } from "@/types";
import { RequestForm } from "./request-form";
import { RequestStatusBadge } from "./request-status-badge";

export function RequestDetailView({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { store, setStore, repositories, isReady } = useLocalLogisticsStore();
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyErrorMessageId, setCopyErrorMessageId] = useState<string | null>(null);
  const [isAssignedEditOpen, setIsAssignedEditOpen] = useState(false);

  const request = useMemo(
    () => store?.requests.find((item) => item.id === requestId),
    [requestId, store?.requests]
  );
  const requestMessages = useMemo(
    () => store?.messages.filter((message) => message.transferRequestId === requestId) ?? [],
    [requestId, store?.messages]
  );
  const orderedRequestMessages = useMemo(
    () =>
      [...requestMessages].sort((first, second) => {
        const firstAudience = getMessageAudienceSortOrder(first);
        const secondAudience = getMessageAudienceSortOrder(second);

        if (firstAudience !== secondAudience) {
          return firstAudience - secondAudience;
        }

        return first.createdAt.localeCompare(second.createdAt);
      }),
    [requestMessages]
  );
  const drivers = store?.drivers ?? [];
  const availableDrivers = drivers.filter((driver) => driver.availability === "available");
  const assignedDriver = store?.drivers.find((driver) => driver.id === request?.assignedDriverId);
  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  const completeness = request ? getTransferRequestCompleteness(request) : null;
  const missingLabels =
    completeness?.missingFields.map((field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field) ?? [];
  const summary = request ? getTransferRequestDisplaySummary(request) : null;
  const reviewText = request ? getTransferRequestReviewText(request) : null;

  async function handleSave(input: CreateTransferRequestInput) {
    if (!store) {
      return;
    }

    await runRequestAction(async () => {
      setStore(await repositories.transferRequests.update(store, requestId, input));
      setNotice("Solicitud actualizada correctamente.");
    });
  }

  async function handleAssignedSave(input: CreateTransferRequestInput) {
    if (!store) {
      return;
    }

    let didSave = false;

    await runRequestAction(async () => {
      setStore(await repositories.transferRequests.update(store, requestId, input));
      setNotice("Solicitud actualizada correctamente.");
      didSave = true;
    });

    if (didSave) {
      setIsAssignedEditOpen(false);
    }
  }

  async function handleMarkReady() {
    if (!store) {
      return;
    }

    await runRequestAction(async () => {
      setStore(await repositories.transferRequests.markReady(store, requestId));
      setNotice("Solicitud aprobada para asignar conductor.");
    });
  }

  async function handleAssignDriver() {
    if (!store) {
      return;
    }

    if (!driverId) {
      setNotice(null);
      setError("Selecciona un conductor antes de asignar.");
      return;
    }

    await runRequestAction(async () => {
      const result = repositories.transferRequests.assignDriver(store, requestId, driverId);
      const resolvedResult = await result;
      setStore(resolvedResult.snapshot);
      setNotice("Traslado asignado y WhatsApp preparados.");
    });
  }

  async function runRequestAction(action: () => Promise<void>) {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la acción.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyMessage(message: RequestMessage) {
    if (!store) {
      return;
    }

    const didCopy = await copyTextToClipboard(message.body);

    if (!didCopy) {
      setCopiedMessageId(null);
      setCopyErrorMessageId(message.id);
      window.setTimeout(() => setCopyErrorMessageId(null), 3000);
      return;
    }

    await runRequestAction(async () => {
      setStore(await repositories.messages.updateStatus(store, message.id, "copied"));
      setCopyErrorMessageId(null);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    });
  }

  async function handleMarkMessageSent(message: RequestMessage) {
    if (!store) {
      return;
    }

    await runRequestAction(async () => {
      setStore(await repositories.messages.updateStatus(store, message.id, "sent"));
      setNotice("Mensaje marcado como enviado manualmente.");
    });
  }

  if (!isReady) {
    return <section className="rounded-lg border bg-card p-4 text-sm">Cargando solicitud...</section>;
  }

  if (!request) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm">No encontramos esta solicitud.</p>
        <Button className="mt-4" onClick={() => router.push("/requests")}>
          Volver a solicitudes
        </Button>
      </section>
    );
  }

  const isAssigned = request.status === "assigned";
  const isIncomplete = request.status === "incomplete";

  const missingDataSection = (
    <section className="rounded-lg border bg-card p-5">
      <h4 className="font-medium">Datos faltantes</h4>
      {missingLabels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {missingLabels.map((label) => (
            <span
              key={label}
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
            >
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-emerald-700">Lista para revisión.</p>
      )}
    </section>
  );

  const editRequestSection = (
    <section className="rounded-lg border bg-card p-5">
      <h4 className="font-medium">
        {isIncomplete ? "Completar datos del traslado" : "Editar datos del traslado"}
      </h4>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        {isIncomplete
          ? "Completa los datos disponibles y guarda avances aunque todavía falte información."
          : "Usa esta sección solo si necesitas corregir información del servicio."}
      </p>
      <RequestForm
        initialValue={request}
        submitLabel={isSaving ? "Guardando..." : getTransferRequestPrimaryActionLabel(request)}
        onSubmit={handleSave}
      />
    </section>
  );

  const assignedEditPanel = (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">Corregir datos del traslado</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            La solicitud ya está asignada. Abre esta sección solo si necesitas corregir un dato.
          </p>
        </div>
        {!isAssignedEditOpen ? (
          <Button type="button" onClick={() => setIsAssignedEditOpen(true)}>
            Editar datos
          </Button>
        ) : null}
      </div>

      {isAssignedEditOpen ? (
        <div className="mt-5 border-t pt-5">
          <RequestForm
            initialValue={request}
            submitLabel={isSaving ? "Guardando..." : "Guardar cambios"}
            onSubmit={handleAssignedSave}
          />
          <Button
            type="button"
            className="mt-3 border border-input bg-white text-foreground hover:bg-muted"
            onClick={() => setIsAssignedEditOpen(false)}
          >
            Cancelar edición
          </Button>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <Link
            href="/requests"
            className="inline-flex h-9 items-center rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Volver a solicitudes
          </Link>
          <RequestStatusBadge status={request.status} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Empresa" value={summary?.company ?? "Empresa pendiente"} />
          <SummaryItem label="Pasajero" value={summary?.passenger ?? "Pasajero pendiente"} />
          <SummaryItem
            label="Ruta"
            value={`${summary?.origin ?? "Origen pendiente"} → ${
              summary?.destination ?? "Destino pendiente"
            }`}
          />
          <SummaryItem
            label="Fecha y hora"
            value={`${summary?.date ?? "Fecha pendiente"} · ${summary?.time ?? "Hora pendiente"}`}
          />
        </div>
        {reviewText ? (
          <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
            {reviewText}
          </p>
        ) : null}
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          <Check className="h-4 w-4" />
          {notice}
        </p>
      ) : null}

      {!isAssigned ? (
        <>
          {missingDataSection}
          {editRequestSection}
        </>
      ) : null}

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">
              {request.status === "ready_to_assign"
                ? "Asignar conductor"
                : isAssigned
                  ? "Traslado asignado"
                  : "Revisión operativa"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isAssigned
                ? "El traslado ya tiene conductor asignado."
                : request.status === "ready_to_assign"
                  ? "Selecciona el conductor que realizará el traslado y confirma la asignación."
                : isIncomplete
                  ? "Antes de asignar conductor, completa los datos faltantes y guarda los avances."
                  : "Revisa que los datos del traslado estén correctos antes de asignar conductor."}
            </p>
          </div>
          {request.status === "pending_review" ? (
            <Button type="button" disabled={!completeness?.isComplete} onClick={handleMarkReady}>
              {isSaving ? "Actualizando..." : "Aprobar para asignar"}
            </Button>
          ) : null}
        </div>

        {request.status === "incomplete" ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No se puede asignar conductor todavía. Faltan: {missingLabels.join(", ")}.
          </p>
        ) : null}

        {request.status === "ready_to_assign" ? (
          <div className="mt-5 space-y-4">
            <div>
              <h5 className="font-medium">Conductor</h5>
              <p className="text-sm text-muted-foreground">
                Selecciona un conductor disponible. El vehículo y patente se tomarán desde su ficha.
              </p>
            </div>
            {availableDrivers.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {availableDrivers.map((driver) => (
                  <DriverOptionCard
                    key={driver.id}
                    driver={driver}
                    isSelected={driver.id === driverId}
                    onSelect={() => {
                      setError(null);
                      setDriverId(driver.id);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p>
                  No hay conductores activos disponibles. Crea o activa un conductor para poder
                  asignar este traslado.
                </p>
                <Link
                  href="/drivers"
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Ir a conductores
                </Link>
              </div>
            )}
            {selectedDriver ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
                Conductor seleccionado: {selectedDriver.fullName}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Elige una tarjeta de conductor para habilitar la asignación.
              </p>
            )}
            <Button
              type="button"
              disabled={!driverId || isSaving}
              onClick={handleAssignDriver}
            >
              {isSaving ? "Asignando..." : "Asignar traslado"}
            </Button>
          </div>
        ) : null}

        {request.status === "assigned" && assignedDriver ? (
          <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-medium">Conductor asignado</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <AssignedDriverItem label="Nombre" value={assignedDriver.fullName} />
              <AssignedDriverItem
                label="Teléfono"
                value={assignedDriver.phone ?? "Teléfono pendiente"}
              />
              <AssignedDriverItem
                label="Vehículo"
                value={assignedDriver.vehicleName ?? "Vehículo pendiente"}
              />
              <AssignedDriverItem
                label="Patente"
                value={assignedDriver.vehiclePlate ?? "Patente pendiente"}
              />
              <AssignedDriverItem
                label="Capacidad"
                value={assignedDriver.vehicleCapacity?.toString() ?? "Pendiente"}
              />
            </div>
          </div>
        ) : null}
      </section>

      {isAssigned ? (
        <section className="rounded-lg border bg-card p-5">
          <h4 className="font-medium">WhatsApp preparados</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Copia estos mensajes para informar al pasajero/solicitante y al conductor. Todavía no se envían
            automáticamente.
          </p>
          {orderedRequestMessages.length > 0 ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {orderedRequestMessages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  copiedMessageId={copiedMessageId}
                  copyErrorMessageId={copyErrorMessageId}
                  onCopy={() => handleCopyMessage(message)}
                  onMarkSent={() => handleMarkMessageSent(message)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No hay mensajes preparados para esta asignación.
            </p>
          )}
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Los WhatsApp para pasajero/solicitante y conductor se prepararán después de asignar el traslado.
        </p>
      )}

      {isAssigned ? (
        <>
          {missingDataSection}
          {assignedEditPanel}
        </>
      ) : null}
    </div>
  );
}

function DriverOptionCard({
  driver,
  isSelected,
  onSelect
}: {
  driver: Driver;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`rounded-lg border p-4 text-sm transition ${
        isSelected ? "border-primary bg-sky-50 ring-2 ring-primary/20" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{driver.fullName}</p>
          <p className="mt-1 text-muted-foreground">{driver.phone ?? "Teléfono pendiente"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isSelected ? (
            <span className="rounded-md border border-primary bg-white px-2 py-1 text-xs font-medium text-primary">
              Seleccionado
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">Vehículo</p>
      <p>{driver.vehicleName ?? "Vehículo pendiente"}</p>
      <p className="mt-1 text-muted-foreground">
        Patente {driver.vehiclePlate ?? "pendiente"} · Capacidad{" "}
        {driver.vehicleCapacity ?? "pendiente"}
      </p>
      <Button
        type="button"
        className={isSelected ? "mt-4 border border-primary bg-primary" : "mt-4"}
        onClick={onSelect}
      >
        {isSelected ? "Conductor seleccionado" : "Seleccionar este conductor"}
      </Button>
    </article>
  );
}

function MessageCard({
  message,
  copiedMessageId,
  copyErrorMessageId,
  onCopy,
  onMarkSent
}: {
  message: RequestMessage;
  copiedMessageId: string | null;
  copyErrorMessageId: string | null;
  onCopy: () => void;
  onMarkSent: () => void;
}) {
  const audience =
    message.metadata?.audience === "driver"
      ? "WhatsApp para conductor"
      : "WhatsApp para pasajero o solicitante";
  const copyLabel =
    message.metadata?.audience === "driver"
      ? "Copiar WhatsApp conductor"
      : "Copiar WhatsApp pasajero";
  const isSent = message.status === "sent";
  const visibleCopyLabel = isSent ? "Copiar nuevamente" : copyLabel;
  const statusLabel =
    copiedMessageId === message.id && message.status !== "sent"
      ? "Copiado"
      : getMessageStatusLabel(message.status);
  const canMarkSent =
    message.status === "generated" ||
    message.status === "copied" ||
    (copiedMessageId === message.id && message.status !== "sent");

  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-medium">{audience}</h5>
          <p className="mt-1 text-sm text-muted-foreground">
            {message.recipientName ?? "Destinatario pendiente"} ·{" "}
            {message.recipientPhone ?? "Teléfono pendiente"}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-700">{statusLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={
              isSent
                ? "h-8 gap-2 border border-input bg-white px-3 text-xs text-foreground hover:bg-muted"
                : "gap-2"
            }
            onClick={onCopy}
          >
            <Copy className="h-4 w-4" />
            {visibleCopyLabel}
          </Button>
          {canMarkSent ? (
            <Button
              type="button"
              className="border border-input bg-white text-foreground hover:bg-muted"
              onClick={onMarkSent}
            >
              Marcar como enviado
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-6">
        {message.body}
      </p>
      {copiedMessageId === message.id ? (
        <p className="mt-2 text-sm font-medium text-emerald-700">Mensaje copiado</p>
      ) : null}
      {copyErrorMessageId === message.id ? (
        <p className="mt-2 text-sm font-medium text-red-700">
          No se pudo copiar. Selecciona y copia el texto manualmente.
        </p>
      ) : null}
    </article>
  );
}

function getMessageStatusLabel(status: RequestMessage["status"]) {
  const labels: Record<RequestMessage["status"], string> = {
    draft: "Borrador",
    generated: "Listo para copiar",
    copied: "Copiado",
    queued: "Listo para copiar",
    sent: "Enviado manualmente",
    failed: "No se pudo preparar"
  };

  return labels[status];
}

function getMessageAudienceSortOrder(message: RequestMessage) {
  if (message.metadata?.audience === "passenger") {
    return 0;
  }

  if (message.metadata?.audience === "driver") {
    return 1;
  }

  return 2;
}

function AssignedDriverItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-indigo-700">{label}</p>
      <p className="mt-1 font-medium text-indigo-950">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
