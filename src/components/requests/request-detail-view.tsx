"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { TRANSFER_REQUEST_STATUS_LABELS } from "@/lib/constants/statuses";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  getTransferRequestDisplaySummary,
  getTransferRequestCompleteness,
  getTransferRequestPrimaryActionLabel,
  getTransferRequestReviewText,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type {
  CommunicationEvent,
  CommunicationEventType,
  CommunicationRecipientType,
  CreateTransferRequestInput,
  Driver,
  RequestMessage,
  TransferRequest,
  TransferRequestStatus,
  TravelEvent
} from "@/types";
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
  const requestCommunicationEvents = useMemo(
    () => (store ? repositories.communicationEvents.listByRequest(store, requestId) : []),
    [requestId, repositories.communicationEvents, store]
  );
  const requestTravelEvents = useMemo(
    () => (store ? repositories.travelEvents.listByRequest(store, requestId) : []),
    [requestId, repositories.travelEvents, store]
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
      const nextStatus = message.status === "sent" ? "sent" : "copied";
      const snapshotWithMessage = await repositories.messages.updateStatus(
        store,
        message.id,
        nextStatus
      );
      const snapshotWithEvent = await repositories.communicationEvents.create(
        snapshotWithMessage,
        buildCommunicationEventInput(message, "copied")
      );

      setStore(snapshotWithEvent);
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
      const snapshotWithMessage = await repositories.messages.updateStatus(store, message.id, "sent");
      const recipientType = getMessageRecipientType(message);
      const alreadyMarkedSent = hasMarkedSentCommunicationEvent(
        snapshotWithMessage.communicationEvents,
        message.transferRequestId,
        recipientType
      );
      const nextSnapshot = alreadyMarkedSent
        ? snapshotWithMessage
        : await repositories.communicationEvents.create(
            snapshotWithMessage,
            buildCommunicationEventInput(message, "marked_sent")
          );

      setStore(nextSnapshot);
      setNotice("Mensaje marcado como enviado manualmente.");
    });
  }

  async function handleManualTravelEvent(input: ManualTravelEventAction) {
    if (!store || !request) {
      return;
    }

    await runRequestAction(async () => {
      const requestInput = buildRequestStatusUpdateInput(request, input.nextStatus);
      const snapshotWithStatus = await repositories.transferRequests.update(
        store,
        request.id,
        requestInput
      );
      const snapshotWithEvent = await repositories.travelEvents.create(snapshotWithStatus, {
        transferRequestId: request.id,
        type: input.eventType,
        source: "manual",
        actorType: "coordinator",
        actorName: "Coordinación",
        actorPhone: null,
        messageBody: input.messageBody,
        latitude: null,
        longitude: null
      });

      setStore(snapshotWithEvent);
      setNotice("Hito del viaje registrado manualmente.");
    });
  }

  async function handleManualTravelCorrection(input: ManualTravelCorrectionInput) {
    if (!store || !request) {
      return;
    }

    const correctionNote = input.note.trim();

    if (!correctionNote) {
      setNotice(null);
      setError("Ingresa una nota para registrar la corrección.");
      return;
    }

    await runRequestAction(async () => {
      const requestInput = buildRequestStatusUpdateInput(request, input.status);
      const snapshotWithStatus = await repositories.transferRequests.update(
        store,
        request.id,
        requestInput
      );
      const snapshotWithEvent = await repositories.travelEvents.create(snapshotWithStatus, {
        transferRequestId: request.id,
        type: "manual_correction",
        source: "manual",
        actorType: "coordinator",
        actorName: "Coordinación",
        actorPhone: null,
        messageBody: `Nuevo estado: ${TRANSFER_REQUEST_STATUS_LABELS[input.status]}. Nota: ${correctionNote}`,
        latitude: null,
        longitude: null
      });

      setStore(snapshotWithEvent);
      setNotice("Seguimiento corregido manualmente.");
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

      <CommunicationHistory events={requestCommunicationEvents} />

      <TravelTrackingHistory
        request={request}
        events={requestTravelEvents}
        assignedDriver={assignedDriver}
        messages={requestMessages}
        isSaving={isSaving}
        onManualEvent={handleManualTravelEvent}
        onManualCorrection={handleManualTravelCorrection}
      />

      {isAssigned ? (
        <>
          {missingDataSection}
          {assignedEditPanel}
        </>
      ) : null}
    </div>
  );
}

function TravelTrackingHistory({
  request,
  events,
  assignedDriver,
  messages,
  isSaving,
  onManualEvent,
  onManualCorrection
}: {
  request: TransferRequest;
  events: TravelEvent[];
  assignedDriver?: Driver;
  messages: RequestMessage[];
  isSaving: boolean;
  onManualEvent: (input: ManualTravelEventAction) => void;
  onManualCorrection: (input: ManualTravelCorrectionInput) => Promise<void> | void;
}) {
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionStatus, setCorrectionStatus] =
    useState<ManualTravelCorrectionStatus>("assigned");
  const [correctionNote, setCorrectionNote] = useState("");
  const steps = buildTravelTimelineSteps({ request, events, assignedDriver, messages });
  const hasIncident = steps.some((step) => step.kind === "incident" && step.status === "done");
  const actions = getManualTravelActions(request.status);
  const canSubmitCorrection = correctionNote.trim().length > 0;

  async function handleCorrectionSubmit() {
    if (!canSubmitCorrection) {
      return;
    }

    await onManualCorrection({
      status: correctionStatus,
      note: correctionNote
    });
    setIsCorrectionOpen(false);
    setCorrectionNote("");
  }

  return (
    <section
      className={`rounded-lg border bg-card p-5 ${
        hasIncident ? "border-orange-300 bg-orange-50/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">Seguimiento del viaje</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Los hitos pueden registrarse desde WhatsApp del conductor usando: 1 Llegué, 2 Salgo
            con pasajero, 3 Finalicé, 9 Incidencia.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            También puedes registrar hitos manualmente si el conductor informa por llamada.
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.eventType}
              type="button"
              className={
                action.eventType === "incident"
                  ? "border border-orange-300 bg-white text-orange-800 hover:bg-orange-50"
                  : ""
              }
              disabled={isSaving}
              onClick={() => onManualEvent(action)}
            >
              {isSaving ? "Registrando..." : action.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          className="border border-input bg-white text-foreground hover:bg-muted"
          disabled={isSaving}
          onClick={() => setIsCorrectionOpen((isOpen) => !isOpen)}
        >
          Corregir seguimiento
        </Button>
      </div>
      {isCorrectionOpen ? (
        <div className="mt-4 rounded-md border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="text-sm font-medium">
              Estado correcto
              <select
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={correctionStatus}
                disabled={isSaving}
                onChange={(event) =>
                  setCorrectionStatus(event.target.value as ManualTravelCorrectionStatus)
                }
              >
                {manualTravelCorrectionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getManualTravelCorrectionStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Nota de corrección
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                value={correctionNote}
                disabled={isSaving}
                placeholder="Ej: Conductor marcó finalizado por error"
                onChange={(event) => setCorrectionNote(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isSaving || !canSubmitCorrection}
              onClick={handleCorrectionSubmit}
            >
              {isSaving ? "Corrigiendo..." : "Confirmar corrección"}
            </Button>
            <Button
              type="button"
              className="border border-input bg-white text-foreground hover:bg-muted"
              disabled={isSaving}
              onClick={() => {
                setIsCorrectionOpen(false);
                setCorrectionNote("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {steps.map((step) => (
          <TravelTimelineStep key={step.key} step={step} />
        ))}
      </div>
    </section>
  );
}

type ManualTravelEventAction = {
  label: string;
  eventType: Exclude<TravelEvent["type"], "manual_correction">;
  nextStatus: Extract<
    TransferRequestStatus,
    "driver_at_pickup" | "passenger_on_board" | "completed" | "incident"
  >;
  messageBody: string;
};

type ManualTravelCorrectionStatus = Extract<
  TransferRequestStatus,
  "assigned" | "driver_at_pickup" | "passenger_on_board" | "completed" | "incident"
>;

type ManualTravelCorrectionInput = {
  status: ManualTravelCorrectionStatus;
  note: string;
};

type TravelTimelineStep = {
  key: string;
  kind: "assigned" | TravelEvent["type"];
  title: string;
  status: "done" | "pending";
  occurredAt?: string | null;
  actor?: string | null;
  source?: string | null;
  detail?: string | null;
  isIncident?: boolean;
};

function TravelTimelineStep({ step }: { step: TravelTimelineStep }) {
  const marker =
    step.status === "done" ? (
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
          step.isIncident
            ? "border-orange-300 bg-orange-100 text-orange-800"
            : "border-emerald-300 bg-emerald-50 text-emerald-800"
        }`}
      >
        ✓
      </span>
    ) : (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs font-semibold text-zinc-500">
        ○
      </span>
    );

  return (
    <div className="grid grid-cols-[24px_1fr] gap-3 text-sm">
      {marker}
      <div
        className={`rounded-md border px-3 py-2 ${
          step.isIncident && step.status === "done"
            ? "border-orange-300 bg-orange-50 text-orange-950"
            : "bg-white"
        }`}
      >
        <p className="font-medium">{step.title}</p>
        {step.status === "done" ? (
          <>
            <p className="mt-1 text-muted-foreground">
              {[
                step.occurredAt ? formatCommunicationDate(step.occurredAt) : null,
                step.actor,
                step.source
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {step.detail ? <p className="mt-1 text-muted-foreground">{step.detail}</p> : null}
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">Pendiente</p>
        )}
      </div>
    </div>
  );
}

function CommunicationHistory({ events }: { events: CommunicationEvent[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h4 className="font-medium">Historial de comunicaciones</h4>
      {events.length > 0 ? (
        <div className="mt-3 divide-y rounded-md border">
          {events.map((event) => (
            <div
              key={event.id}
              className="grid gap-1 px-3 py-2 text-sm md:grid-cols-[160px_1.4fr_1fr_1fr_auto] md:items-center"
            >
              <span className="font-medium text-foreground">
                {formatCommunicationDate(event.createdAt)}
              </span>
              <span>{getCommunicationEventLabel(event.type)}</span>
              <span className="text-muted-foreground">
                {event.recipientName ?? "Destinatario pendiente"}
              </span>
              <span className="text-muted-foreground">
                {event.recipientPhone ?? "Teléfono pendiente"}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                WhatsApp
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay comunicaciones registradas para esta solicitud.
        </p>
      )}
    </section>
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

function buildCommunicationEventInput(
  message: RequestMessage,
  action: "copied" | "marked_sent"
) {
  const recipientType = getMessageRecipientType(message);

  return {
    transferRequestId: message.transferRequestId,
    type: getCommunicationEventType(recipientType, action),
    channel: "whatsapp" as const,
    recipientType,
    recipientName: message.recipientName ?? null,
    recipientPhone: message.recipientPhone ?? null,
    messageBody: message.body,
    createdBy: null
  };
}

function getMessageRecipientType(message: RequestMessage): CommunicationRecipientType {
  return message.metadata?.audience === "driver" ? "driver" : "passenger";
}

function getCommunicationEventType(
  recipientType: CommunicationRecipientType,
  action: "copied" | "marked_sent"
): CommunicationEventType {
  if (recipientType === "driver") {
    return action === "copied" ? "whatsapp_driver_copied" : "whatsapp_driver_marked_sent";
  }

  return action === "copied" ? "whatsapp_passenger_copied" : "whatsapp_passenger_marked_sent";
}

function hasMarkedSentCommunicationEvent(
  events: CommunicationEvent[],
  transferRequestId: string,
  recipientType: CommunicationRecipientType
) {
  const sentType = getCommunicationEventType(recipientType, "marked_sent");

  return events.some(
    (event) => event.transferRequestId === transferRequestId && event.type === sentType
  );
}

function getCommunicationEventLabel(type: CommunicationEventType) {
  const labels: Record<CommunicationEventType, string> = {
    whatsapp_passenger_copied: "WhatsApp pasajero copiado",
    whatsapp_driver_copied: "WhatsApp conductor copiado",
    whatsapp_passenger_marked_sent: "WhatsApp pasajero marcado como enviado",
    whatsapp_driver_marked_sent: "WhatsApp conductor marcado como enviado"
  };

  return labels[type];
}

function buildTravelTimelineSteps({
  request,
  events,
  assignedDriver,
  messages
}: {
  request: TransferRequest;
  events: TravelEvent[];
  assignedDriver?: Driver;
  messages: RequestMessage[];
}): TravelTimelineStep[] {
  const driverAtPickup = getTravelEventByType(events, "driver_at_pickup");
  const passengerOnBoard = getTravelEventByType(events, "passenger_on_board");
  const completed = getTravelEventByType(events, "completed");
  const incident = getTravelEventByType(events, "incident");
  const correctionEvents = [...events]
    .filter((event) => event.type === "manual_correction")
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const assignmentMessage = [...messages]
    .filter((message) => message.template === "driver_assignment")
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))[0];
  const assignedAt = assignmentMessage?.createdAt ?? request.updatedAt;
  const assignedActor = assignedDriver?.fullName ?? "Conductor pendiente";

  const steps: TravelTimelineStep[] = [
    {
      key: "assigned",
      kind: "assigned",
      title: "Traslado asignado",
      status: isTravelStepDone(request, "assigned") ? "done" : "pending",
      occurredAt: assignedAt,
      actor: assignedActor,
      source: "Sistema"
    },
    buildTravelEventStep({
      kind: "driver_at_pickup",
      title: "Conductor en origen",
      request,
      event: driverAtPickup,
      assignedDriver
    }),
    buildTravelEventStep({
      kind: "passenger_on_board",
      title: "Pasajero a bordo / En traslado",
      request,
      event: passengerOnBoard,
      assignedDriver
    }),
    buildTravelEventStep({
      kind: "completed",
      title: "Servicio finalizado",
      request,
      event: completed,
      assignedDriver
    })
  ];

  if (incident || request.status === "incident") {
    steps.push(
      buildTravelEventStep({
        kind: "incident",
        title: "Incidencia",
        request,
        event: incident,
        assignedDriver,
        isIncident: true
      })
    );
  }

  correctionEvents.forEach((event) => {
    steps.push({
      key: `manual_correction-${event.id}`,
      kind: "manual_correction",
      title: "Corrección manual",
      status: "done",
      occurredAt: event.createdAt,
      actor: event.actorName ?? "Coordinación",
      source: getTravelEventSourceLabel(event.source),
      detail: event.messageBody
    });
  });

  return steps;
}

function getManualTravelActions(status: TransferRequestStatus): ManualTravelEventAction[] {
  const incidentAction: ManualTravelEventAction = {
    label: "Registrar incidencia",
    eventType: "incident",
    nextStatus: "incident",
    messageBody: "Incidencia registrada manualmente"
  };

  if (status === "assigned") {
    return [
      {
        label: "Registrar llegada al origen",
        eventType: "driver_at_pickup",
        nextStatus: "driver_at_pickup",
        messageBody: "Llegada al origen registrada manualmente"
      },
      incidentAction
    ];
  }

  if (status === "driver_at_pickup") {
    return [
      {
        label: "Registrar salida con pasajero",
        eventType: "passenger_on_board",
        nextStatus: "passenger_on_board",
        messageBody: "Salida con pasajero registrada manualmente"
      },
      incidentAction
    ];
  }

  if (status === "passenger_on_board") {
    return [
      {
        label: "Finalizar servicio",
        eventType: "completed",
        nextStatus: "completed",
        messageBody: "Servicio finalizado manualmente"
      },
      incidentAction
    ];
  }

  return [];
}

function buildRequestStatusUpdateInput(
  request: TransferRequest,
  status: TransferRequestStatus
): CreateTransferRequestInput {
  return {
    companyId: request.companyId,
    companyName: request.companyName,
    requesterName: request.requesterName,
    requesterPhone: request.requesterPhone,
    requesterEmail: request.requesterEmail,
    passengerName: request.passengerName,
    passengerPhone: request.passengerPhone,
    originAddress: request.originAddress,
    destinationAddress: request.destinationAddress,
    pickupDate: request.pickupDate,
    pickupTime: request.pickupTime,
    pickupAt: request.pickupAt,
    passengerCount: request.passengerCount,
    cargoDescription: request.cargoDescription,
    specialRequirements: request.specialRequirements,
    notes: request.notes,
    assignedDriverId: request.assignedDriverId,
    assignedVehicleId: request.assignedVehicleId,
    status
  };
}

function buildTravelEventStep({
  kind,
  title,
  request,
  event,
  assignedDriver,
  isIncident = false
}: {
  kind: TravelEvent["type"];
  title: string;
  request: TransferRequest;
  event?: TravelEvent;
  assignedDriver?: Driver;
  isIncident?: boolean;
}): TravelTimelineStep {
  const isDone = Boolean(event) || isTravelStepDone(request, kind);

  return {
    key: kind,
    kind,
    title,
    status: isDone ? "done" : "pending",
    occurredAt: event?.createdAt ?? (isDone ? request.updatedAt : null),
    actor: event?.actorName ?? assignedDriver?.fullName ?? null,
    source: event ? getTravelEventSourceLabel(event.source) : isDone ? "Sistema" : null,
    isIncident
  };
}

function getTravelEventByType(events: TravelEvent[], type: TravelEvent["type"]) {
  return [...events]
    .filter((event) => event.type === type)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
}

function isTravelStepDone(request: TransferRequest, step: TravelTimelineStep["kind"]) {
  const currentIndex = travelStatusOrder.indexOf(request.status);
  const stepIndex = travelStatusOrder.indexOf(step);

  if (step === "incident") {
    return request.status === "incident";
  }

  if (step === "assigned") {
    return Boolean(request.assignedDriverId) || currentIndex >= travelStatusOrder.indexOf("assigned");
  }

  return currentIndex >= stepIndex && stepIndex >= 0;
}

const travelStatusOrder: string[] = [
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "completed"
];

function getTravelEventSourceLabel(source: TravelEvent["source"]) {
  return source === "whatsapp_driver" ? "WhatsApp conductor" : "Manual";
}

function getTravelEventLabel(type: TravelEvent["type"]) {
  const labels: Record<TravelEvent["type"], string> = {
    driver_at_pickup: "Conductor llegó al origen",
    passenger_on_board: "Pasajero a bordo",
    completed: "Servicio finalizado",
    incident: "Incidencia reportada",
    manual_correction: "Corrección manual"
  };

  return labels[type];
}

const manualTravelCorrectionStatuses: ManualTravelCorrectionStatus[] = [
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "completed",
  "incident"
];

function getManualTravelCorrectionStatusLabel(status: ManualTravelCorrectionStatus) {
  const labels: Record<ManualTravelCorrectionStatus, string> = {
    assigned: "Traslado asignado",
    driver_at_pickup: "Conductor en origen",
    passenger_on_board: "Pasajero a bordo / En traslado",
    completed: "Servicio finalizado",
    incident: "Incidencia"
  };

  return labels[status];
}

function formatCommunicationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const datePart = date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timePart = date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `${datePart.replaceAll("-", "/")} ${timePart}`;
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
