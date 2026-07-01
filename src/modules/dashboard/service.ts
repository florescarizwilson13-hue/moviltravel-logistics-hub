import {
  getTransferRequestCompleteness,
  getTransferRequestDisplaySummary,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type { Driver, RequestMessage, TransferRequest } from "@/types";

type DashboardStoreInput = {
  requests: TransferRequest[];
  drivers: Driver[];
  messages: RequestMessage[];
};

export function buildDashboardOverview(store: DashboardStoreInput) {
  const openRequests = store.requests.filter(
    (request) => !["completed", "cancelled"].includes(request.status)
  );
  const attentionRequests = store.requests.filter((request) =>
    ["incomplete", "pending_review", "ready_to_assign"].includes(request.status)
  );

  return {
    metrics: {
      openRequests: openRequests.length,
      incomplete: countByStatus(store.requests, "incomplete"),
      pendingReview: countByStatus(store.requests, "pending_review"),
      readyToAssign: countByStatus(store.requests, "ready_to_assign"),
      assigned: countByStatus(store.requests, "assigned"),
      generatedMessages: store.messages.length,
      activeDrivers: store.drivers.filter((driver) => driver.availability === "available").length
    },
    attentionRequests: attentionRequests.map(toDashboardRequestItem),
    latestMessages: buildLatestMessageGroups(store.messages, store.requests),
    activeDrivers: store.drivers
      .filter((driver) => driver.availability === "available")
      .map(toDashboardDriverItem)
  };
}

function countByStatus(requests: TransferRequest[], status: TransferRequest["status"]) {
  return requests.filter((request) => request.status === status).length;
}

function toDashboardRequestItem(request: TransferRequest) {
  const summary = getTransferRequestDisplaySummary(request);
  const completeness = getTransferRequestCompleteness(request);

  return {
    id: request.id,
    status: request.status,
    passenger: summary.passenger,
    company: summary.company,
    date: summary.date,
    time: summary.time,
    origin: summary.origin,
    destination: summary.destination,
    missingFields: completeness.missingFields.map(
      (field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field
    )
  };
}

function toDashboardDriverItem(driver: Driver) {
  return {
    id: driver.id,
    fullName: driver.fullName,
    phone: driver.phone ?? "Teléfono pendiente",
    vehicleName: driver.vehicleName ?? "Vehículo pendiente",
    vehiclePlate: driver.vehiclePlate ?? "Patente pendiente",
    vehicleCapacity: driver.vehicleCapacity ?? "Capacidad pendiente"
  };
}

function buildLatestMessageGroups(messages: RequestMessage[], requests: TransferRequest[]) {
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  const groupsByRequestId = new Map<
    string,
    {
      requestId: string;
      title: string;
      route: string;
      readyMessages: number;
      sentMessages: number;
      pendingMessages: number;
      latestCreatedAt: string;
    }
  >();

  for (const message of messages) {
    const request = requestsById.get(message.transferRequestId);
    const currentGroup = groupsByRequestId.get(message.transferRequestId);
    const isSent = message.status === "sent";
    const isPending = message.status === "generated" || message.status === "copied";

    if (currentGroup) {
      currentGroup.readyMessages += 1;
      currentGroup.sentMessages += isSent ? 1 : 0;
      currentGroup.pendingMessages += isPending ? 1 : 0;
      if (message.createdAt.localeCompare(currentGroup.latestCreatedAt) > 0) {
        currentGroup.latestCreatedAt = message.createdAt;
      }
      continue;
    }

    groupsByRequestId.set(message.transferRequestId, {
      requestId: message.transferRequestId,
      title: getMessageGroupTitle(request, message),
      route: getMessageGroupRoute(request),
      readyMessages: 1,
      sentMessages: isSent ? 1 : 0,
      pendingMessages: isPending ? 1 : 0,
      latestCreatedAt: message.createdAt
    });
  }

  return [...groupsByRequestId.values()]
    .sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt))
    .slice(0, 5);
}

function getMessageGroupTitle(request: TransferRequest | undefined, message: RequestMessage) {
  return (
    request?.passengerName ??
    request?.requesterName ??
    message.recipientName ??
    message.recipientPhone ??
    "Solicitud sin nombre"
  );
}

function getMessageGroupRoute(request: TransferRequest | undefined) {
  if (!request?.originAddress && !request?.destinationAddress) {
    return "Ruta pendiente";
  }

  return `${request.originAddress ?? "Origen pendiente"} → ${
    request.destinationAddress ?? "Destino pendiente"
  }`;
}
