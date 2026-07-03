import type { AiCaptureProvider } from "./provider";
import {
  getTransferRequestCompleteness,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type { CreateTransferRequestInput, TransferRequest } from "@/types";

export const mockAiCaptureProvider: AiCaptureProvider = {
  async captureTransferRequest({ message, previousData }) {
    const capturedData = {
      ...previousData,
      ...extractSimpleTransferFields(message)
    } as CreateTransferRequestInput;
    const completeness = getTransferRequestCompleteness(capturedData);
    const missingFields = completeness.missingFields.map(
      (field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field
    );
    const extractedFields = Object.entries(capturedData)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([field]) => field);

    return {
      capturedData,
      missingFields,
      confidence: calculateConfidence(capturedData),
      readyForReview: completeness.isComplete,
      extractedFields,
      assistantMessage: buildAssistantMessage(missingFields)
    };
  }
};

function extractSimpleTransferFields(message: string): CreateTransferRequestInput {
  const data: CreateTransferRequestInput = {
    notes: message.trim()
  };
  const normalized = message.toLowerCase();

  data.passengerName = extractPassengerName(message);
  data.passengerCount = extractPassengerCount(normalized);
  data.pickupTime = extractPickupTime(message);
  data.pickupDate = extractPickupDate(normalized);
  data.originAddress = extractOrigin(message);
  data.destinationAddress = extractDestination(message);
  data.companyName = extractCompany(message);
  data.requesterPhone = extractPhone(message, [
    "teléfono de contacto",
    "telefono de contacto",
    "teléfono contacto",
    "telefono contacto",
    "fono contacto",
    "teléfono solicitante",
    "telefono solicitante",
    "fono solicitante",
    "contacto"
  ]);
  data.passengerPhone = extractPhone(message, [
    "teléfono del pasajero",
    "telefono del pasajero",
    "teléfono pasajero",
    "telefono pasajero",
    "fono pasajero",
    "celular pasajero",
    "pasajero"
  ]);
  data.requesterName = extractRequesterName(message);

  if (normalized.includes("origen:")) {
    data.originAddress = readValueAfterLabel(message, "origen:");
  }

  if (normalized.includes("destino:")) {
    data.destinationAddress = cleanDestinationPrefix(readValueAfterLabel(message, "destino:"));
  }

  if (normalized.includes("telefono:") && !data.requesterPhone && !data.passengerPhone) {
    data.requesterPhone = readValueAfterLabel(message, "telefono:");
  }

  if (normalized.includes("nombre:")) {
    data.requesterName = readValueAfterLabel(message, "nombre:");
  }

  if (normalized.includes("fecha:")) {
    data.pickupDate = readValueAfterLabel(message, "fecha:");
  }

  return data;
}

function extractPassengerName(message: string) {
  return matchFirst(message, /\bpara\s+([A-ZÁÉÍÓÚÑ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}]+){0,3})/u);
}

function extractRequesterName(message: string) {
  return matchFirst(message, /\bsolicita(?:nte)?\s+([A-ZÁÉÍÓÚÑ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}]+){0,3})/iu);
}

function extractCompany(message: string) {
  return matchFirst(message, /\bempresa\s+([^,.;\n]+)/i);
}

function extractPassengerCount(normalized: string) {
  const numericMatch = normalized.match(
    /\b(?:ser[ií]an\s+|somos\s+|para\s+)?(\d{1,2})\s*(pasajero|pasajeros|persona|personas|pax)\b/
  );

  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  const wordMatch = normalized.match(
    /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(pasajero|pasajeros|persona|personas|pax)\b/
  );

  if (wordMatch?.[1]) {
    return numberWordToValue(wordMatch[1]);
  }

  const somosMatch = normalized.match(
    /\bsomos\s+(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\b/
  );

  if (!somosMatch?.[1]) {
    return undefined;
  }

  return /^\d+$/.test(somosMatch[1]) ? Number(somosMatch[1]) : numberWordToValue(somosMatch[1]);
}

function extractPickupTime(message: string) {
  const match = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : undefined;
}

function extractPickupDate(normalized: string) {
  if (/\bmañana\b/.test(normalized)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  const isoDate = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) {
    return isoDate[1];
  }

  const shortDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (!shortDate) {
    return undefined;
  }

  const [, day, month, year] = shortDate;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractOrigin(message: string) {
  return matchFirst(
    message,
    /\bdesde\s+(.+?)(?=\s+(?:hasta|al|a)\s+[A-ZÁÉÍÓÚÑ0-9]|[.,;\n]|$)/iu
  );
}

function extractDestination(message: string) {
  const matches = [...message.matchAll(/\b(?:hasta|al|a)\s+(.+?)(?:[.,;\n]|$)/giu)]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .map(cleanDestinationPrefix)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !value.toLowerCase().startsWith("las "));

  return matches.at(-1);
}

function cleanDestinationPrefix(value: string | undefined) {
  return value
    ?.replace(/^(?:hasta|hacia|a la|al|a|para)\s+/i, "")
    .trim();
}

function extractPhone(message: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = message.match(new RegExp(`${escaped}\\s*:?\\s*(\\+?\\d[\\d\\s-]{7,})`, "i"));
    if (match?.[1]) {
      return match[1].replace(/\s+/g, "");
    }
  }

  return undefined;
}

function numberWordToValue(value: string) {
  const normalized = value.toLowerCase();
  const numbers: Record<string, number> = {
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };

  return numbers[normalized];
}

function matchFirst(message: string, pattern: RegExp) {
  const match = message.match(pattern);
  return match?.[1]?.trim();
}

function calculateConfidence(data: Partial<TransferRequest>) {
  const completeness = getTransferRequestCompleteness(data);
  const totalRequired = completeness.missingFields.length + 10 - completeness.missingFields.length;
  const foundRequired = 10 - completeness.missingFields.length;
  return Math.max(0.35, Math.min(0.95, foundRequired / totalRequired));
}

function buildAssistantMessage(missingFields: string[]) {
  if (missingFields.length === 0) {
    return "Gracias. Ya tenemos los datos mínimos para revisar la solicitud.";
  }

  const fields = missingFields.slice(0, 4).join(", ");
  return `Gracias. Para coordinar el traslado, ¿me indicas ${fields}?`;
}

function readValueAfterLabel(message: string, label: string) {
  const start = message.toLowerCase().indexOf(label);
  if (start === -1) {
    return undefined;
  }

  const value = message.slice(start + label.length).split("\n")[0]?.trim();
  return value || undefined;
}
