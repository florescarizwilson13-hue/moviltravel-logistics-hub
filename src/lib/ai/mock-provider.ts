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
  data.requesterPhone = extractPhone(message, ["teléfono solicitante", "telefono solicitante", "contacto", "teléfono", "telefono"]);
  data.passengerPhone = extractPhone(message, ["teléfono pasajero", "telefono pasajero"]);
  data.requesterName = extractRequesterName(message);

  if (normalized.includes("origen:")) {
    data.originAddress = readValueAfterLabel(message, "origen:");
  }

  if (normalized.includes("destino:")) {
    data.destinationAddress = readValueAfterLabel(message, "destino:");
  }

  if (normalized.includes("telefono:")) {
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
  const match = normalized.match(/\b(\d{1,2})\s*(pasajeros|personas|pax)\b/);
  return match ? Number(match[1]) : undefined;
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
    /\bdesde\s+(.+?)(?=\s+(?:al|a)\s+[A-ZÁÉÍÓÚÑ0-9]|[.,;\n]|$)/iu
  );
}

function extractDestination(message: string) {
  const matches = [...message.matchAll(/\b(?:al|a)\s+(.+?)(?:[.,;\n]|$)/giu)]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .filter((value) => !value.toLowerCase().startsWith("las "));

  return matches.at(-1);
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
