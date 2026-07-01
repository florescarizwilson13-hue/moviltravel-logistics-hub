"use client";

import Link from "next/link";
import { Copy, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { copyTextToClipboard } from "@/utils/clipboard";
import { createAiCaptureService } from "@/modules/ai-capture";
import {
  getTransferRequestCompleteness,
  getTransferRequestDisplaySummary,
  getTransferRequestReviewText,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type {
  AiCaptureResult,
  AiCompletionResult,
  CreateTransferRequestInput,
  TransferRequest
} from "@/types";

const aiCaptureService = createAiCaptureService();

const sampleMessage =
  "Hola, necesito traslado mañana a las 10:30 para María López, 2 pasajeros, desde Hotel Plaza Santiago al Aeropuerto SCL.";

const followUpSample =
  "Empresa Clínica Sur, solicitante Ana Pérez, teléfono solicitante +56911112222, teléfono pasajero +56933334444.";

const fieldOrder: Array<keyof CreateTransferRequestInput> = [
  "companyName",
  "requesterName",
  "requesterPhone",
  "passengerName",
  "passengerPhone",
  "passengerCount",
  "pickupDate",
  "pickupTime",
  "originAddress",
  "destinationAddress",
  "notes"
];

type CaptureMode = "new" | "existing";

export function AiCaptureWorkbench() {
  const { store, setStore, repositories, error: loadError, isReady, isRefreshing } = useLocalLogisticsStore();
  const [mode, setMode] = useState<CaptureMode>("new");
  const [message, setMessage] = useState(sampleMessage);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [newResult, setNewResult] = useState<AiCaptureResult | null>(null);
  const [completionResult, setCompletionResult] = useState<AiCompletionResult | null>(null);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [updatedRequestSnapshot, setUpdatedRequestSnapshot] = useState<TransferRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incompleteRequests = useMemo(
    () =>
      store?.requests.filter((request) => !getTransferRequestCompleteness(request).isComplete) ??
      [],
    [store?.requests]
  );
  const selectedRequest = store?.requests.find((request) => request.id === selectedRequestId);

  function switchMode(nextMode: CaptureMode) {
    setMode(nextMode);
    setError(null);
    setNewResult(null);
    setCompletionResult(null);
    setTargetRequestId(null);
    setUpdatedRequestSnapshot(null);
    setMessage(nextMode === "new" ? sampleMessage : followUpSample);
  }

  async function handleAnalyze() {
    setError(null);
    setTargetRequestId(null);

    if (mode === "existing") {
      if (!selectedRequest) {
        setError("Primero selecciona una solicitud incompleta.");
        return;
      }

      if (!message.trim()) {
        setError("Pega la respuesta del cliente antes de analizar.");
        return;
      }

      const analysis = await aiCaptureService.completeExistingTransferRequest({
        request: selectedRequest,
        message
      });
      setCompletionResult(analysis);
      setNewResult(null);
      return;
    }

    if (!message.trim()) {
      setError("Escribe o pega un mensaje antes de analizar.");
      return;
    }

    const analysis = await aiCaptureService.captureTransferRequest({ message });
    setNewResult(analysis);
    setCompletionResult(null);
  }

  async function handleCreateRequest() {
    if (!store || !newResult) {
      return;
    }

    try {
      setError(null);
      const creation = await repositories.transferRequests.create(store, newResult.capturedData);
      setStore(creation.snapshot);
      setTargetRequestId(creation.request.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la solicitud.");
    }
  }

  async function handleUpdateRequest() {
    if (!store || !selectedRequest || !completionResult) {
      return;
    }

    try {
      setError(null);
      const nextStore = await repositories.transferRequests.update(
        store,
        selectedRequest.id,
        completionResult.mergedData
      );
      const updatedRequest =
        nextStore.requests.find((request) => request.id === selectedRequest.id) ?? null;
      setStore(nextStore);
      setTargetRequestId(selectedRequest.id);
      setUpdatedRequestSnapshot(updatedRequest);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la solicitud.");
    }
  }

  async function handleCopyResponse() {
    const assistantMessage = newResult?.assistantMessage ?? completionResult?.assistantMessage;

    if (!assistantMessage) {
      return;
    }

    const didCopy = await copyTextToClipboard(assistantMessage);

    if (!didCopy) {
      setCopied(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 3000);
      return;
    }

    setCopyFailed(false);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!isReady || isRefreshing) {
    return <section className="rounded-lg border bg-card p-4 text-sm">Preparando captura...</section>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4" />
          Captura asistida: revisa siempre los datos antes de guardar.
        </div>
        <p className="mt-1">
          Esta pantalla ayuda a convertir mensajes de clientes en solicitudes de traslado.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <ModeButton isActive={mode === "new"} onClick={() => switchMode("new")}>
            Nueva solicitud
          </ModeButton>
          <ModeButton isActive={mode === "existing"} onClick={() => switchMode("existing")}>
            Completar solicitud existente
          </ModeButton>
        </div>

        {mode === "existing" ? (
          <ExistingCompletionFlow
            requests={incompleteRequests}
            selectedRequestId={selectedRequestId}
            selectedRequest={selectedRequest}
            updatedRequest={updatedRequestSnapshot}
            message={message}
            error={error}
            loadError={loadError}
            onSelect={(requestId) => {
              setSelectedRequestId(requestId);
              setCompletionResult(null);
              setTargetRequestId(null);
              setUpdatedRequestSnapshot(null);
              setError(null);
            }}
            onMessageChange={setMessage}
            onAnalyze={handleAnalyze}
          />
        ) : (
          <>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium">Mensaje libre del cliente</span>
              <textarea
                className="min-h-40 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            {loadError ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {loadError}
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
            <Button type="button" className="mt-4" onClick={handleAnalyze}>
              Analizar solicitud
            </Button>
          </>
        )}
      </section>

      {newResult ? (
        <NewRequestResult
          result={newResult}
          copied={copied}
          copyFailed={copyFailed}
          targetRequestId={targetRequestId}
          onCopyResponse={handleCopyResponse}
          onCreateRequest={handleCreateRequest}
        />
      ) : null}

      {completionResult && (selectedRequest || updatedRequestSnapshot) ? (
        <CompletionResult
          result={completionResult}
          copied={copied}
          copyFailed={copyFailed}
          targetRequestId={targetRequestId}
          onCopyResponse={handleCopyResponse}
          onUpdateRequest={handleUpdateRequest}
        />
      ) : null}
    </div>
  );
}

function ModeButton({
  isActive,
  onClick,
  children
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border px-3 py-2 text-sm font-medium ${
        isActive ? "border-primary bg-sky-50 text-primary" : "hover:bg-muted"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ExistingCompletionFlow({
  requests,
  selectedRequestId,
  selectedRequest,
  updatedRequest,
  message,
  error,
  loadError,
  onSelect,
  onMessageChange,
  onAnalyze
}: {
  requests: TransferRequest[];
  selectedRequestId: string;
  selectedRequest?: TransferRequest;
  updatedRequest?: TransferRequest | null;
  message: string;
  error: string | null;
  loadError: string | null;
  onSelect: (requestId: string) => void;
  onMessageChange: (value: string) => void;
  onAnalyze: () => void;
}) {
  const [isListOpen, setIsListOpen] = useState(!selectedRequest);

  return (
    <div className="mt-4 space-y-4">
      <StepPanel step="Paso 1" title="Selecciona la solicitud incompleta">
        {selectedRequest ? (
          <div className="space-y-3">
            <SelectedRequestBanner request={selectedRequest} />
            <Button
              type="button"
              className="border border-input bg-white text-foreground hover:bg-muted"
              onClick={() => setIsListOpen((current) => !current)}
            >
              {isListOpen ? "Ocultar solicitudes pendientes" : "Cambiar solicitud"}
            </Button>
          </div>
        ) : null}
        {!selectedRequest && updatedRequest ? (
          <SelectedRequestBanner request={updatedRequest} title="Solicitud actualizada" />
        ) : null}
        {isListOpen || !selectedRequest ? (
          <ExistingRequestPicker
            requests={requests}
            selectedRequestId={selectedRequestId}
            onSelect={(requestId) => {
              onSelect(requestId);
              setIsListOpen(false);
            }}
          />
        ) : null}
      </StepPanel>

      <StepPanel step="Paso 2" title="Pega la respuesta del cliente">
        <label className="block space-y-2">
          <span className="text-sm font-medium">
            Pega aquí la nueva respuesta del cliente
          </span>
          <textarea
            className="min-h-40 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
          />
        </label>
        {!selectedRequest ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Primero selecciona una solicitud incompleta.
          </p>
        ) : null}
        {!message.trim() ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pega la respuesta del cliente antes de analizar.
          </p>
        ) : null}
        {loadError ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {loadError}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold uppercase text-primary">Paso 3</p>
          <h3 className="mt-1 font-medium">Analiza y actualiza la solicitud</h3>
          <Button type="button" className="mt-3" disabled={!selectedRequest} onClick={onAnalyze}>
            Analizar respuesta del cliente
          </Button>
        </div>
      </StepPanel>
    </div>
  );
}

function StepPanel({
  step,
  title,
  children
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase text-primary">{step}</p>
        <h3 className="mt-1 font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ExistingRequestPicker({
  requests,
  selectedRequestId,
  onSelect
}: {
  requests: TransferRequest[];
  selectedRequestId: string;
  onSelect: (requestId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="font-medium">Solicitudes pendientes de completar</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige la solicitud que corresponde al nuevo mensaje del cliente.
        </p>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay solicitudes pendientes de completar. Cuando exista una solicitud incompleta aparecerá aquí.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3">
          {requests.map((request) => (
            <IncompleteRequestCard
              key={request.id}
              request={request}
              isSelected={request.id === selectedRequestId}
              onSelect={() => onSelect(request.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectedRequestBanner({
  request,
  title = "Solicitud seleccionada"
}: {
  request: TransferRequest;
  title?: string;
}) {
  const summary = getTransferRequestDisplaySummary(request);
  const completeness = getTransferRequestCompleteness(request);

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
      <p className="font-semibold text-sky-900">{title}</p>
      <div className="mt-3 grid gap-2 text-sky-950 md:grid-cols-2">
        <p>Empresa: {summary.company}</p>
        <p>Pasajero: {summary.passenger}</p>
        <p>Ruta: {summary.origin} → {summary.destination}</p>
        <p>Fecha/hora: {summary.date} · {summary.time}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {completeness.missingFields.map((field) => (
          <span
            key={field}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          >
            {TRANSFER_REQUEST_FIELD_LABELS[field] ?? field}
          </span>
        ))}
      </div>
    </div>
  );
}

function IncompleteRequestCard({
  request,
  isSelected,
  onSelect
}: {
  request: TransferRequest;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const summary = getTransferRequestDisplaySummary(request);
  const completeness = getTransferRequestCompleteness(request);
  const createdAt = request.createdAt ? new Date(request.createdAt).toLocaleString("es-CL") : "Sin fecha";
  const reviewText = getTransferRequestReviewText(request) ?? "Incompleta";

  return (
    <article
      className={`rounded-lg border p-4 text-sm ${
        isSelected ? "border-primary bg-sky-50 ring-2 ring-primary/20" : "bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{summary.passenger}</p>
          <p className="mt-1 text-muted-foreground">{summary.company}</p>
        </div>
        <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
          {reviewText}
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <p>Fecha/hora: {summary.date} · {summary.time}</p>
        <p>Creada: {createdAt}</p>
        <p className="md:col-span-2">
          Ruta: {summary.origin} → {summary.destination}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {completeness.missingFields.map((field) => (
          <span
            key={field}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          >
            {TRANSFER_REQUEST_FIELD_LABELS[field] ?? field}
          </span>
        ))}
      </div>
      <Button type="button" className="mt-4" onClick={onSelect}>
        Completar esta solicitud
      </Button>
    </article>
  );
}

function NewRequestResult({
  result,
  copied,
  copyFailed,
  targetRequestId,
  onCopyResponse,
  onCreateRequest
}: {
  result: AiCaptureResult;
  copied: boolean;
  copyFailed: boolean;
  targetRequestId: string | null;
  onCopyResponse: () => void;
  onCreateRequest: () => void;
}) {
  return (
    <ResultShell
      title="Datos detectados"
      confidence={result.confidence}
      ready={result.readyForReview}
    >
      <ResultGrid
        data={result.capturedData}
        missingFields={result.missingFields}
        assistantMessage={result.assistantMessage}
        copied={copied}
        copyFailed={copyFailed}
        onCopyResponse={onCopyResponse}
      />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onCreateRequest}>
          Crear solicitud con estos datos
        </Button>
        {targetRequestId ? <RequestDetailLink requestId={targetRequestId} label="Abrir solicitud creada" /> : null}
      </div>
    </ResultShell>
  );
}

function CompletionResult({
  result,
  copied,
  copyFailed,
  targetRequestId,
  onCopyResponse,
  onUpdateRequest
}: {
  result: AiCompletionResult;
  copied: boolean;
  copyFailed: boolean;
  targetRequestId: string | null;
  onCopyResponse: () => void;
  onUpdateRequest: () => void;
}) {
  return (
    <ResultShell
      title="Resultado para completar solicitud"
      confidence={result.confidence}
      ready={result.readyForReviewAfterMerge}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h4 className="font-medium">Datos que se agregarán</h4>
          {result.newlyAppliedFields.length > 0 ? (
            <dl className="mt-3 grid gap-3 text-sm">
              {result.newlyAppliedFields.map((field) => (
                <div key={field} className="grid grid-cols-[170px_1fr] gap-3">
                  <dt className="text-muted-foreground">{getFieldLabel(field)}</dt>
                  <dd className="font-medium">{formatExtractedValue(result.mergedData[field])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No se detectaron datos nuevos aplicables a campos pendientes.
            </p>
          )}
          {result.skippedExistingFields.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Algunos datos detectados ya existían y no fueron reemplazados automáticamente.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border p-4">
          <h4 className="font-medium">Datos que siguen faltando</h4>
          {result.missingFieldsAfterMerge.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.missingFieldsAfterMerge.map((field) => (
                <span
                  key={field}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                >
                  {field}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-emerald-700">
              La solicitud quedará lista para revisión.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">Respuesta sugerida</h4>
          <Button type="button" className="gap-2" onClick={onCopyResponse}>
            <Copy className="h-4 w-4" />
            Copiar respuesta
          </Button>
        </div>
        <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-6">
          {result.assistantMessage}
        </p>
        {copied ? <p className="mt-2 text-sm font-medium text-emerald-700">Respuesta copiada.</p> : null}
        {copyFailed ? (
          <p className="mt-2 text-sm font-medium text-red-700">
            No se pudo copiar. Selecciona y copia el texto manualmente.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onUpdateRequest}>
          Actualizar solicitud
        </Button>
        {targetRequestId ? (
          <>
            <p className="text-sm font-medium text-emerald-700">Solicitud actualizada correctamente.</p>
            <RequestDetailLink requestId={targetRequestId} label="Abrir solicitud actualizada" />
          </>
        ) : null}
      </div>
    </ResultShell>
  );
}

function ResultShell({
  title,
  confidence,
  ready,
  children
}: {
  title: string;
  confidence: number;
  ready: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Confianza estimada: {Math.round(confidence * 100)}%
          </p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            ready
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {ready ? "Lista para revisión" : "Solicitud incompleta"}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ResultGrid({
  data,
  missingFields,
  assistantMessage,
  copied,
  copyFailed,
  onCopyResponse
}: {
  data: CreateTransferRequestInput;
  missingFields: string[];
  assistantMessage: string;
  copied: boolean;
  copyFailed: boolean;
  onCopyResponse: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h4 className="font-medium">Datos extraídos</h4>
        <dl className="mt-3 grid gap-3 text-sm">
          {fieldOrder.map((field) => (
            <div key={field} className="grid grid-cols-[170px_1fr] gap-3">
              <dt className="text-muted-foreground">{getFieldLabel(field)}</dt>
              <dd className="font-medium">{formatExtractedValue(data[field])}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h4 className="font-medium">Datos faltantes</h4>
          {missingFields.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <span
                  key={field}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                >
                  {field}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-emerald-700">
              Tiene los datos mínimos para revisión.
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium">Respuesta sugerida</h4>
            <Button type="button" className="gap-2" onClick={onCopyResponse}>
              <Copy className="h-4 w-4" />
              Copiar respuesta
            </Button>
          </div>
          <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-6">{assistantMessage}</p>
          {copied ? <p className="mt-2 text-sm font-medium text-emerald-700">Mensaje copiado</p> : null}
          {copyFailed ? (
            <p className="mt-2 text-sm font-medium text-red-700">
              No se pudo copiar. Selecciona y copia el texto manualmente.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RequestDetailLink({ requestId, label }: { requestId: string; label: string }) {
  return (
    <Link
      href={`/requests/${requestId}`}
      className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
    >
      {label}
    </Link>
  );
}

function getFieldLabel(field: keyof CreateTransferRequestInput | keyof TransferRequest) {
  return TRANSFER_REQUEST_FIELD_LABELS[field as keyof TransferRequest] ?? "Notas";
}

function formatExtractedValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Pendiente";
  }

  return String(value);
}
