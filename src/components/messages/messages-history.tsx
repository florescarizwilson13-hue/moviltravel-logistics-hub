"use client";

import Link from "next/link";
import { Copy, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import { copyTextToClipboard } from "@/utils/clipboard";
import type { MessageStatus, RequestMessage, TransferRequest } from "@/types";

type MessageFilter = "all" | "pending" | "sent" | "passenger" | "driver";

type TransferMessageGroup = {
  transferRequestId: string;
  request?: TransferRequest;
  messages: RequestMessage[];
  latestCreatedAt: string;
};

const messageFilters: Array<{ label: string; value: MessageFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Pendientes de enviar", value: "pending" },
  { label: "Enviados", value: "sent" },
  { label: "Pasajero/solicitante", value: "passenger" },
  { label: "Conductor", value: "driver" }
];

const statusLabels: Record<MessageStatus, string> = {
  draft: "Borrador",
  generated: "Listo para copiar",
  copied: "Copiado",
  queued: "Listo para copiar",
  sent: "Enviado manualmente",
  failed: "No se pudo preparar"
};

export function MessagesHistory() {
  const { store, setStore, repositories, error, isRefreshing, isReady } = useLocalLogisticsStore();
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [search, setSearch] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyErrorMessageId, setCopyErrorMessageId] = useState<string | null>(null);
  const [actionErrorMessageId, setActionErrorMessageId] = useState<string | null>(null);

  const messages = useMemo(() => {
    if (!store) {
      return [];
    }

    return repositories.messages.list(store);
  }, [repositories.messages, store]);

  const groupedMessages = useMemo(() => {
    if (!store) {
      return [];
    }

    return buildTransferMessageGroups(messages, store.requests);
  }, [messages, store]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return groupedMessages
      .map((group) => {
        const matchingMessages = group.messages.filter((message) => {
          if (!doesMessageMatchFilter(message, messageFilter)) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return getGroupSearchText(group, message).includes(normalizedSearch);
        });

        return {
          ...group,
          messages: matchingMessages
        };
      })
      .filter((group) => group.messages.length > 0);
  }, [groupedMessages, messageFilter, search]);

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

    try {
      setStore(await repositories.messages.updateStatus(store, message.id, "copied"));
      setActionErrorMessageId(null);
      setCopyErrorMessageId(null);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setActionErrorMessageId(message.id);
    }
  }

  async function handleMarkMessageSent(message: RequestMessage) {
    if (!store) {
      return;
    }

    try {
      setStore(await repositories.messages.updateStatus(store, message.id, "sent"));
      setActionErrorMessageId(null);
    } catch {
      setActionErrorMessageId(message.id);
    }
  }

  if (!isReady || isRefreshing) {
    return <section className="rounded-lg border bg-card p-5 text-sm">Cargando mensajes...</section>;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-sm font-medium">Buscar mensajes</span>
            <span className="flex h-10 items-center gap-2 rounded-md border border-input bg-white px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Buscar por pasajero, conductor, ruta, teléfono o mensaje"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            {messageFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`h-10 rounded-md border px-3 text-sm font-medium transition ${
                  messageFilter === filter.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-white text-foreground hover:bg-muted"
                }`}
                onClick={() => setMessageFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {messages.length === 0 ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Todavía no hay WhatsApp preparados. Cuando asignes un conductor, aparecerán aquí.
        </section>
      ) : null}

      {messages.length > 0 && filteredGroups.length === 0 ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No encontramos mensajes con esos filtros.
        </section>
      ) : null}

      {filteredGroups.length > 0 ? (
        <section className="grid gap-4">
          {filteredGroups.map((group) => (
            <TransferMessagesCard
              key={group.transferRequestId}
              group={group}
              copiedMessageId={copiedMessageId}
              copyErrorMessageId={copyErrorMessageId}
              actionErrorMessageId={actionErrorMessageId}
              onCopy={handleCopyMessage}
              onMarkSent={handleMarkMessageSent}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TransferMessagesCard({
  group,
  copiedMessageId,
  copyErrorMessageId,
  actionErrorMessageId,
  onCopy,
  onMarkSent
}: {
  group: TransferMessageGroup;
  copiedMessageId: string | null;
  copyErrorMessageId: string | null;
  actionErrorMessageId: string | null;
  onCopy: (message: RequestMessage) => void;
  onMarkSent: (message: RequestMessage) => void;
}) {
  const title = getGroupTitle(group);
  const route = getGroupRoute(group);
  const serviceDateTime = getGroupServiceDateTime(group);
  const pendingCount = group.messages.filter((message) =>
    message.status === "generated" || message.status === "copied"
  ).length;
  const sentCount = group.messages.filter((message) => message.status === "sent").length;

  return (
    <article className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Traslado</p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <SummaryLine label="Ruta" value={route} />
            <SummaryLine label="Fecha/hora" value={serviceDateTime} />
          </div>
          <span className="mt-3 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {pendingCount} por enviar · {sentCount} enviados
          </span>
        </div>

        <Link
          href={`/requests/${group.transferRequestId}`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted"
        >
          Ver solicitud
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {group.messages.map((message) => (
          <MessageBlock
            key={message.id}
            message={message}
            copiedMessageId={copiedMessageId}
            copyErrorMessageId={copyErrorMessageId}
            actionErrorMessageId={actionErrorMessageId}
            onCopy={() => onCopy(message)}
            onMarkSent={() => onMarkSent(message)}
          />
        ))}
      </div>
    </article>
  );
}

function MessageBlock({
  message,
  copiedMessageId,
  copyErrorMessageId,
  actionErrorMessageId,
  onCopy,
  onMarkSent
}: {
  message: RequestMessage;
  copiedMessageId: string | null;
  copyErrorMessageId: string | null;
  actionErrorMessageId: string | null;
  onCopy: () => void;
  onMarkSent: () => void;
}) {
  const audience = getMessageAudience(message);
  const title =
    audience === "driver" ? "WhatsApp conductor" : "WhatsApp pasajero/solicitante";
  const copyLabel =
    audience === "driver" ? "Copiar WhatsApp conductor" : "Copiar WhatsApp pasajero";
  const isSent = message.status === "sent";
  const visibleCopyLabel = isSent ? "Copiar nuevamente" : copyLabel;
  const statusLabel =
    copiedMessageId === message.id && message.status !== "sent"
      ? "Copiado"
      : statusLabels[message.status];
  const canMarkSent =
    message.status === "generated" ||
    message.status === "copied" ||
    (copiedMessageId === message.id && message.status !== "sent");

  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {message.recipientName ?? "Destinatario pendiente"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {message.recipientPhone ?? "Teléfono pendiente"}
          </p>
          <span className="mt-2 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {statusLabel}
          </span>
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
      {actionErrorMessageId === message.id ? (
        <p className="mt-2 text-sm font-medium text-red-700">
          No se pudo actualizar el estado del mensaje.
        </p>
      ) : null}
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-foreground">{label}: </span>
      {value}
    </p>
  );
}

function buildTransferMessageGroups(
  messages: RequestMessage[],
  requests: TransferRequest[]
): TransferMessageGroup[] {
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  const groupsByRequestId = new Map<string, TransferMessageGroup>();

  for (const message of messages) {
    const currentGroup = groupsByRequestId.get(message.transferRequestId);

    if (currentGroup) {
      currentGroup.messages.push(message);
      if (message.createdAt.localeCompare(currentGroup.latestCreatedAt) > 0) {
        currentGroup.latestCreatedAt = message.createdAt;
      }
      continue;
    }

    groupsByRequestId.set(message.transferRequestId, {
      transferRequestId: message.transferRequestId,
      request: requestsById.get(message.transferRequestId),
      messages: [message],
      latestCreatedAt: message.createdAt
    });
  }

  return [...groupsByRequestId.values()]
    .map((group) => ({
      ...group,
      messages: sortMessagesByAudience(group.messages)
    }))
    .sort((first, second) => second.latestCreatedAt.localeCompare(first.latestCreatedAt));
}

function sortMessagesByAudience(messages: RequestMessage[]) {
  return [...messages].sort((first, second) => {
    const audienceDifference =
      getMessageAudienceSortOrder(first) - getMessageAudienceSortOrder(second);

    if (audienceDifference !== 0) {
      return audienceDifference;
    }

    return first.createdAt.localeCompare(second.createdAt);
  });
}

function getMessageAudience(message: RequestMessage): Extract<MessageFilter, "passenger" | "driver"> {
  return message.metadata?.audience === "driver" ? "driver" : "passenger";
}

function doesMessageMatchFilter(message: RequestMessage, filter: MessageFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "pending") {
    return message.status === "generated" || message.status === "copied";
  }

  if (filter === "sent") {
    return message.status === "sent";
  }

  return getMessageAudience(message) === filter;
}

function getMessageAudienceSortOrder(message: RequestMessage) {
  return getMessageAudience(message) === "passenger" ? 0 : 1;
}

function getGroupTitle(group: TransferMessageGroup) {
  return (
    group.request?.passengerName ??
    group.request?.requesterName ??
    group.messages.find((message) => getMessageAudience(message) === "passenger")?.recipientName ??
    group.messages[0]?.recipientName ??
    "Solicitud sin nombre"
  );
}

function getGroupRoute(group: TransferMessageGroup) {
  if (group.request?.originAddress || group.request?.destinationAddress) {
    return `${group.request.originAddress ?? "Origen pendiente"} → ${
      group.request.destinationAddress ?? "Destino pendiente"
    }`;
  }

  return "Ruta pendiente";
}

function getGroupServiceDateTime(group: TransferMessageGroup) {
  const date = group.request?.pickupDate;
  const time = group.request?.pickupTime;

  if (date || time) {
    return `${date ?? "Fecha pendiente"} · ${time ?? "Hora pendiente"}`;
  }

  return "Fecha/hora pendiente";
}

function getGroupSearchText(group: TransferMessageGroup, message: RequestMessage) {
  const driverMessage = group.messages.find((item) => getMessageAudience(item) === "driver");

  return normalizeSearch(
    [
      getGroupTitle(group),
      getGroupRoute(group),
      getGroupServiceDateTime(group),
      group.request?.companyName,
      group.request?.requesterName,
      group.request?.requesterPhone,
      group.request?.passengerName,
      group.request?.passengerPhone,
      driverMessage?.recipientName,
      driverMessage?.recipientPhone,
      getMessageAudience(message) === "driver" ? "conductor" : "pasajero solicitante",
      message.recipientName,
      message.recipientPhone,
      message.body,
      statusLabels[message.status]
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
