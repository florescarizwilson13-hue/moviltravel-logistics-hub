import type { GeneratedWhatsappMessage, MessageTemplate, TransferRequest } from "@/types";
import type { Driver } from "@/types";

type WhatsappMessageInput = {
  request: Partial<TransferRequest>;
  template: MessageTemplate;
  recipientName?: string | null;
  recipientPhone?: string | null;
  metadata?: Record<string, unknown>;
};

export function generateWhatsappMessage({
  request,
  template,
  recipientName,
  recipientPhone,
  metadata
}: WhatsappMessageInput): GeneratedWhatsappMessage {
  return {
    transferRequestId: request.id ?? "pending-request-id",
    channel: "whatsapp",
    template,
    recipientName: recipientName ?? request.passengerName ?? request.requesterName ?? null,
    recipientPhone: recipientPhone ?? request.requesterPhone ?? null,
    body: buildWhatsappBody(request, template),
    status: "generated",
    metadata: metadata ?? null
  };
}

export function generateAssignmentWhatsappMessages(
  request: TransferRequest,
  driver: Driver
): GeneratedWhatsappMessage[] {
  return [
    {
      transferRequestId: request.id,
      channel: "whatsapp",
      template: "driver_assignment",
      recipientName: request.passengerName ?? request.requesterName ?? null,
      recipientPhone: request.passengerPhone ?? request.requesterPhone ?? null,
      body: buildPassengerAssignmentBody(request, driver),
      status: "generated",
      metadata: { audience: "passenger", driverId: driver.id }
    },
    {
      transferRequestId: request.id,
      channel: "whatsapp",
      template: "driver_assignment",
      recipientName: driver.fullName,
      recipientPhone: driver.phone ?? null,
      body: buildDriverAssignmentBody(request),
      status: "generated",
      metadata: { audience: "driver", driverId: driver.id }
    }
  ];
}

function buildWhatsappBody(request: Partial<TransferRequest>, template: MessageTemplate) {
  if (template === "missing_information") {
    return [
      "Hola, necesitamos completar algunos datos de tu solicitud de traslado.",
      "Por favor indícanos origen, destino, fecha/hora y teléfono de contacto."
    ].join(" ");
  }

  if (template === "driver_assignment") {
    return [
      "Tu solicitud de traslado ya fue asignada.",
      request.pickupDate && request.pickupTime
        ? `Horario: ${request.pickupDate} ${request.pickupTime}.`
        : "Confirmaremos el horario pronto."
    ].join(" ");
  }

  return [
    "Resumen de solicitud de traslado:",
    `Origen: ${request.originAddress ?? "pendiente"}.`,
    `Destino: ${request.destinationAddress ?? "pendiente"}.`,
    `Fecha/hora: ${formatPickup(request)}.`
  ].join(" ");
}

function buildPassengerAssignmentBody(request: TransferRequest, driver: Driver) {
  return [
    `Hola ${request.passengerName ?? request.requesterName ?? ""}.`.trim(),
    "Tu traslado fue asignado.",
    "",
    `Conductor: ${driver.fullName}`,
    `Teléfono conductor: ${driver.phone ?? "por confirmar"}`,
    `Vehículo: ${driver.vehicleName ?? "por confirmar"}`,
    `Patente: ${driver.vehiclePlate ?? "por confirmar"}`,
    "",
    `Origen: ${request.originAddress ?? "por confirmar"}`,
    `Destino: ${request.destinationAddress ?? "por confirmar"}`,
    `Horario: ${formatPickup(request)}`
  ]
    .join("\n");
}

function buildDriverAssignmentBody(request: TransferRequest) {
  return [
    "Nuevo traslado asignado.",
    "",
    `Pasajero: ${request.passengerName ?? "por confirmar"}`,
    `Teléfono: ${request.passengerPhone ?? request.requesterPhone ?? "por confirmar"}`,
    `Pasajeros: ${request.passengerCount ?? "por confirmar"}`,
    "",
    `Origen: ${request.originAddress ?? "por confirmar"}`,
    `Destino: ${request.destinationAddress ?? "por confirmar"}`,
    `Horario: ${formatPickup(request)}`,
    "",
    `Notas: ${request.notes ? trimTrailingPeriod(request.notes) : "Sin notas"}`
  ]
    .join("\n");
}

function formatPickup(request: Partial<TransferRequest>) {
  if (request.pickupDate && request.pickupTime) {
    return `${request.pickupDate} ${request.pickupTime}`;
  }

  return request.pickupAt ?? "pendiente";
}

function trimTrailingPeriod(value: string) {
  return value.trim().replace(/\.+$/, "");
}
