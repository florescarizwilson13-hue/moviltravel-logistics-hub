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
      recipientPhone: formatChilePhone(request.passengerPhone ?? request.requesterPhone),
      body: buildPassengerAssignmentBody(request, driver),
      status: "generated",
      metadata: { audience: "passenger", driverId: driver.id }
    },
    {
      transferRequestId: request.id,
      channel: "whatsapp",
      template: "driver_assignment",
      recipientName: formatDisplayName(driver.fullName),
      recipientPhone: formatChilePhone(driver.phone),
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
  const passengerName = formatDisplayName(request.passengerName ?? request.requesterName);

  return compactLines([
    "✅ Traslado asignado",
    "",
    passengerName
      ? `Hola ${passengerName}, tu traslado ya fue asignado.`
      : "Tu traslado ya fue asignado.",
    "",
    serviceDateLine(request),
    request.originAddress ? `📍 Origen: ${request.originAddress}` : null,
    request.destinationAddress ? `🏁 Destino: ${request.destinationAddress}` : null,
    request.passengerCount ? `👥 Pasajeros: ${request.passengerCount}` : null,
    "",
    "🚘 Conductor asignado",
    driver.fullName ? `👤 Nombre: ${formatDisplayName(driver.fullName)}` : null,
    driver.phone ? `📞 Teléfono: ${formatChilePhone(driver.phone)}` : null,
    driver.vehicleName ? `🚗 Vehículo: ${formatDisplayName(driver.vehicleName)}` : null,
    driver.vehiclePlate ? `🔢 Patente: ${driver.vehiclePlate.toUpperCase()}` : null,
    "",
    "Gracias por coordinar con Moviltravel."
  ]);
}

function buildDriverAssignmentBody(request: TransferRequest) {
  return compactLines([
    "🚘 Nuevo traslado asignado",
    "",
    serviceDateLine(request),
    request.originAddress ? `📍 Origen: ${request.originAddress}` : null,
    request.destinationAddress ? `🏁 Destino: ${request.destinationAddress}` : null,
    "",
    "👤 Pasajero",
    request.passengerName ? `Nombre: ${request.passengerName}` : null,
    request.passengerPhone ? `📞 Teléfono: ${formatChilePhone(request.passengerPhone)}` : null,
    request.passengerCount
      ? `👥 Cantidad: ${request.passengerCount} ${
          request.passengerCount === 1 ? "pasajero" : "pasajeros"
        }`
      : null,
    "",
    "🏢 Solicitante",
    request.requesterName ? `Nombre: ${request.requesterName}` : null,
    request.requesterPhone ? `📞 Teléfono: ${formatChilePhone(request.requesterPhone)}` : null,
    request.companyName ? `Empresa: ${request.companyName}` : null
  ]);
}

function formatPickup(request: Partial<TransferRequest>) {
  if (request.pickupDate && request.pickupTime) {
    return `${request.pickupDate} ${request.pickupTime}`;
  }

  return request.pickupAt ?? "pendiente";
}

function serviceDateLine(request: Partial<TransferRequest>) {
  const formatted = formatPickupForWhatsapp(request);
  return formatted ? `📅 Fecha y hora: ${formatted}` : null;
}

function formatPickupForWhatsapp(request: Partial<TransferRequest>) {
  if (request.pickupDate && request.pickupTime) {
    return `${formatChileanDate(request.pickupDate)} ${request.pickupTime}`;
  }

  return request.pickupAt ? formatPickupAt(request.pickupAt) : null;
}

function formatChileanDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function formatPickupAt(value: string) {
  const [date, rawTime] = value.split("T");
  const time = rawTime?.slice(0, 5);

  if (!date || !time) {
    return value;
  }

  return `${formatChileanDate(date)} ${time}`;
}

function formatChilePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return `+56${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("569")) {
    return `+${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("0569")) {
    return `+${digits.slice(1)}`;
  }

  return value?.trim() ?? null;
}

function formatDisplayName(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return "";
  }

  return cleanValue
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map(formatDisplayWord)
        .join("-")
    )
    .join(" ");
}

function formatDisplayWord(word: string) {
  if (word === word.toUpperCase()) {
    return word;
  }

  if (/\d/.test(word)) {
    return word.toUpperCase();
  }

  return `${word.slice(0, 1).toLocaleUpperCase("es-CL")}${word
    .slice(1)
    .toLocaleLowerCase("es-CL")}`;
}

function compactLines(lines: Array<string | null>) {
  return lines
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
