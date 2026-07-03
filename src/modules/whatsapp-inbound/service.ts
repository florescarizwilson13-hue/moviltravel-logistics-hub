import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { createAiCaptureService } from "@/modules/ai-capture";
import {
  buildTransferRequestDraft,
  getTransferRequestCompleteness,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type {
  AiCaptureResult,
  CreateTransferRequestInput,
  TransferRequest,
  TransferRequestStatus
} from "@/types";

export type TwilioWhatsappInboundPayload = {
  From?: string;
  To?: string;
  Body?: string;
  ProfileName?: string;
  MessageSid?: string;
  SmsMessageSid?: string;
};

export type WhatsappInboundResult = {
  requestId: string | null;
  analysis: AiCaptureResult | null;
  reply: string;
};

const aiCaptureService = createAiCaptureService();
const incompleteWhatsappStatuses: TransferRequestStatus[] = ["draft", "incomplete", "pending_review"];
const whatsappMissingFieldLabels: Partial<Record<keyof CreateTransferRequestInput, string>> = {
  companyName: "empresa",
  requesterName: "solicitante",
  requesterPhone: "teléfono de contacto",
  passengerName: "pasajero",
  passengerPhone: "teléfono del pasajero",
  passengerCount: "cantidad de pasajeros",
  pickupDate: "fecha",
  pickupTime: "hora",
  originAddress: "origen",
  destinationAddress: "destino"
};

type TransferRequestIntakeRow = {
  id: string;
  company_id: string | null;
  company_name: string | null;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  passenger_name: string | null;
  passenger_phone: string | null;
  origin_address: string | null;
  destination_address: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_at: string | null;
  passenger_count: number | null;
  cargo_description: string | null;
  special_requirements: string | null;
  notes: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: TransferRequestStatus;
  metadata: Record<string, unknown>;
};

export async function processWhatsappInboundMessage(
  payload: TwilioWhatsappInboundPayload
): Promise<WhatsappInboundResult> {
  const body = payload.Body?.trim();

  if (!body) {
    return {
      requestId: null,
      analysis: null,
      reply: "Hola. Envíanos los datos del traslado: pasajero, origen, destino, fecha, hora y cantidad de pasajeros."
    };
  }

  const analysis = await aiCaptureService.captureTransferRequest({ message: body });
  const supabase = await createTrustedSupabaseClient();
  const existingRequest = await findLatestOpenWhatsappRequest(supabase, payload.From);
  const requestInput = existingRequest
    ? mergeRequestWithCapturedData(existingRequest, analysis.capturedData, payload)
    : withWhatsappContext(analysis.capturedData, payload);
  const request = buildTransferRequestDraft(requestInput);
  const metadata = buildWhatsappMetadata({
    previousMetadata: existingRequest?.metadata,
    payload,
    analysis,
    body
  });

  const write = existingRequest
    ? supabase
        .from("transfer_requests")
        .update(mapTransferRequestForWrite(request, metadata))
        .eq("id", existingRequest.id)
        .select("id")
        .single<{ id: string }>()
    : supabase
        .from("transfer_requests")
        .insert(mapTransferRequestForWrite(request, metadata))
        .select("id")
        .single<{ id: string }>();

  const { data, error } = await write;

  if (error) {
    throw new Error(`No se pudo guardar la solicitud recibida por WhatsApp: ${error.message}`);
  }

  const requestId = data?.id ?? null;
  const reply = buildWhatsappReply(request);
  await saveAiConversationAttempt({
    payload,
    requestId,
    analysis,
    reply
  });

  return {
    requestId,
    analysis,
    reply
  };
}

async function findLatestOpenWhatsappRequest(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  from: string | undefined
) {
  if (!from) {
    return null;
  }

  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      "id, company_id, company_name, requester_name, requester_phone, requester_email, passenger_name, passenger_phone, origin_address, destination_address, pickup_date, pickup_time, pickup_at, passenger_count, cargo_description, special_requirements, notes, assigned_driver_id, assigned_vehicle_id, status, metadata"
    )
    .in("status", incompleteWhatsappStatuses)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`No se pudo buscar la conversación de WhatsApp: ${error.message}`);
  }

  return (
    ((data ?? []) as TransferRequestIntakeRow[]).find((request) => {
      const metadata = request.metadata ?? {};
      return metadata.whatsapp_from === from || metadata.from === from;
    }) ?? null
  );
}

async function createTrustedSupabaseClient() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return createSupabaseServerClient();
  }
}

async function saveAiConversationAttempt(input: {
  payload: TwilioWhatsappInboundPayload;
  requestId: string | null;
  analysis: AiCaptureResult;
  reply: string;
}) {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("ai_conversations").insert({
      transfer_request_id: input.requestId,
      provider: "mock",
      status: input.analysis.readyForReview ? "completed" : "open",
      source_channel: "whatsapp",
      source_reference: input.payload.MessageSid ?? input.payload.SmsMessageSid ?? input.payload.From ?? null,
      captured_data: input.analysis.capturedData,
      missing_fields: input.analysis.missingFields,
      confidence: input.analysis.confidence,
      messages: [
        {
          role: "user",
          content: input.payload.Body ?? "",
          createdAt: new Date().toISOString()
        },
        {
          role: "assistant",
          content: input.reply,
          createdAt: new Date().toISOString()
        }
      ],
      metadata: {
        source: "twilio_whatsapp_sandbox",
        from: input.payload.From ?? null,
        to: input.payload.To ?? null,
        profileName: input.payload.ProfileName ?? null
      }
    });
  } catch {
    // Request creation is the durable intake path; conversation storage is best-effort here.
  }
}

function withWhatsappContext(
  capturedData: CreateTransferRequestInput,
  payload: TwilioWhatsappInboundPayload
): CreateTransferRequestInput {
  const whatsappPhone = normalizeWhatsappAddress(payload.From);
  const sourceLines = [
    "Origen solicitud: WhatsApp Twilio Sandbox",
    payload.ProfileName ? `Perfil WhatsApp: ${payload.ProfileName}` : null,
    payload.From ? `Desde: ${payload.From}` : null,
    capturedData.notes
  ].filter(Boolean);

  return {
    ...capturedData,
    requesterName: capturedData.requesterName ?? payload.ProfileName ?? null,
    requesterPhone: capturedData.requesterPhone ?? whatsappPhone ?? null,
    notes: sourceLines.join("\n")
  };
}

function mergeRequestWithCapturedData(
  existingRequest: TransferRequestIntakeRow,
  capturedData: CreateTransferRequestInput,
  payload: TwilioWhatsappInboundPayload
): CreateTransferRequestInput {
  const existingData = mapTransferRequestRowToInput(existingRequest);
  const nextData = mergeEmptyFields(existingData, capturedData);
  const withContext = withWhatsappContext(nextData, payload);

  return {
    ...withContext,
    notes: appendUniqueNotes(withContext.notes, capturedData.notes)
  };
}

function mapTransferRequestRowToInput(row: TransferRequestIntakeRow): CreateTransferRequestInput {
  return {
    companyId: row.company_id,
    companyName: row.company_name,
    requesterName: row.requester_name,
    requesterPhone: row.requester_phone,
    requesterEmail: row.requester_email,
    passengerName: row.passenger_name,
    passengerPhone: row.passenger_phone,
    originAddress: row.origin_address,
    destinationAddress: row.destination_address,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time?.slice(0, 5) ?? null,
    pickupAt: row.pickup_at,
    passengerCount: row.passenger_count,
    cargoDescription: row.cargo_description,
    specialRequirements: row.special_requirements,
    notes: row.notes,
    assignedDriverId: row.assigned_driver_id,
    assignedVehicleId: row.assigned_vehicle_id,
    status: row.status
  };
}

function mergeEmptyFields(
  existingData: CreateTransferRequestInput,
  capturedData: CreateTransferRequestInput
) {
  const shouldReplaceDateTime = Boolean(capturedData.pickupDate || capturedData.pickupTime);

  return {
    ...existingData,
    companyName: pickExistingOrCaptured(existingData.companyName, capturedData.companyName),
    requesterName: pickExistingOrCaptured(existingData.requesterName, capturedData.requesterName),
    requesterPhone: pickExistingOrCaptured(existingData.requesterPhone, capturedData.requesterPhone),
    requesterEmail: pickExistingOrCaptured(existingData.requesterEmail, capturedData.requesterEmail),
    passengerName: pickExistingOrCaptured(existingData.passengerName, capturedData.passengerName),
    passengerPhone: pickExistingOrCaptured(existingData.passengerPhone, capturedData.passengerPhone),
    originAddress: pickExistingOrCaptured(existingData.originAddress, capturedData.originAddress),
    destinationAddress: pickExistingOrCaptured(
      existingData.destinationAddress,
      capturedData.destinationAddress
    ),
    pickupDate: shouldReplaceDateTime
      ? capturedData.pickupDate ?? existingData.pickupDate
      : pickExistingOrCaptured(existingData.pickupDate, capturedData.pickupDate),
    pickupTime: shouldReplaceDateTime
      ? capturedData.pickupTime ?? existingData.pickupTime
      : pickExistingOrCaptured(existingData.pickupTime, capturedData.pickupTime),
    pickupAt: shouldReplaceDateTime
      ? null
      : pickExistingOrCaptured(existingData.pickupAt, capturedData.pickupAt),
    passengerCount: pickExistingOrCaptured(
      existingData.passengerCount,
      capturedData.passengerCount
    ),
    cargoDescription: pickExistingOrCaptured(
      existingData.cargoDescription,
      capturedData.cargoDescription
    ),
    specialRequirements: pickExistingOrCaptured(
      existingData.specialRequirements,
      capturedData.specialRequirements
    )
  };
}

function pickExistingOrCaptured<T>(existingValue: T | null | undefined, capturedValue: T | null | undefined) {
  return isEmpty(existingValue) ? capturedValue ?? null : existingValue;
}

function appendUniqueNotes(existingNotes: string | null | undefined, nextNotes: string | null | undefined) {
  const notes = [existingNotes, nextNotes]
    .map((note) => note?.trim())
    .filter((note): note is string => Boolean(note));
  return [...new Set(notes)].join("\n\n") || null;
}

function mapTransferRequestForWrite(
  request: ReturnType<typeof buildTransferRequestDraft>,
  metadata: Record<string, unknown>
) {
  return {
    company_id: request.companyId ?? null,
    company_name: request.companyName ?? null,
    requester_name: request.requesterName ?? null,
    requester_phone: request.requesterPhone ?? null,
    requester_email: request.requesterEmail ?? null,
    passenger_name: request.passengerName ?? null,
    passenger_phone: request.passengerPhone ?? null,
    origin_address: request.originAddress ?? null,
    destination_address: request.destinationAddress ?? null,
    pickup_date: request.pickupDate ?? null,
    pickup_time: request.pickupTime ?? null,
    pickup_at: request.pickupAt ?? null,
    passenger_count: request.passengerCount ?? null,
    cargo_description: request.cargoDescription ?? null,
    special_requirements: request.specialRequirements ?? null,
    notes: request.notes ?? null,
    assigned_driver_id: null,
    assigned_vehicle_id: null,
    status: request.status,
    metadata
  };
}

function buildWhatsappMetadata(input: {
  previousMetadata?: Record<string, unknown>;
  payload: TwilioWhatsappInboundPayload;
  analysis: AiCaptureResult;
  body: string;
}) {
  const now = new Date().toISOString();
  const previousMessages = Array.isArray(input.previousMetadata?.conversation_messages)
    ? input.previousMetadata.conversation_messages
    : [];
  const nextMessage = {
    direction: "inbound",
    body: input.body,
    messageSid: input.payload.MessageSid ?? input.payload.SmsMessageSid ?? null,
    receivedAt: now
  };

  return {
    ...(input.previousMetadata ?? {}),
    source: "twilio_whatsapp_sandbox",
    whatsapp_from: input.payload.From ?? null,
    whatsapp_to: input.payload.To ?? null,
    whatsapp_profile_name: input.payload.ProfileName ?? null,
    last_inbound_message_at: now,
    last_inbound_message: nextMessage,
    conversation_messages: [...previousMessages, nextMessage].slice(-10),
    ai: {
      confidence: input.analysis.confidence,
      extractedFields: input.analysis.extractedFields,
      missingFields: input.analysis.missingFields,
      readyForReview: input.analysis.readyForReview
    }
  };
}

function normalizeWhatsappAddress(value: string | undefined) {
  return value?.replace(/^whatsapp:/i, "").trim() || null;
}

function buildWhatsappReply(request: ReturnType<typeof buildTransferRequestDraft>) {
  const completeness = getTransferRequestCompleteness(request);
  const summary = buildCapturedSummary(request);

  if (completeness.isComplete) {
    const requesterFirstName = getFirstName(request.requesterName);
    const greeting = requesterFirstName ? `Perfecto, ${requesterFirstName}.` : "Perfecto.";

    return `${greeting} Dejé registrada la solicitud${summary ? ` ${summary}` : ""}. El equipo la revisará y coordinará la asignación del conductor.`;
  }

  const missingFields = completeness.missingFields
    .map(getWhatsappMissingFieldLabel)
    .slice(0, 6);
  const question = missingFields.length > 0
    ? `Para dejarlo listo, ¿me indicas ${formatNaturalList(missingFields)}?`
    : "Para dejarlo listo, ¿me confirmas los datos pendientes?";

  if (!summary) {
    return `Gracias. ${question}`;
  }

  return `Gracias. Tengo registrado el traslado ${summary}. ${question}`;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}

function getWhatsappMissingFieldLabel(field: keyof TransferRequest) {
  return (
    whatsappMissingFieldLabels[field as keyof CreateTransferRequestInput] ??
    TRANSFER_REQUEST_FIELD_LABELS[field] ??
    field
  );
}

function buildCapturedSummary(request: ReturnType<typeof buildTransferRequestDraft>) {
  const parts: string[] = [];

  if (request.passengerName) {
    parts.push(`para ${request.passengerName}`);
  }

  if (request.passengerCount) {
    parts.push(`${request.passengerCount} ${request.passengerCount === 1 ? "pasajero" : "pasajeros"}`);
  }

  if (request.pickupDate && request.pickupTime) {
    parts.push(`para ${formatWhatsappDate(request.pickupDate)} a las ${request.pickupTime}`);
  } else if (request.pickupDate) {
    parts.push(`para ${formatWhatsappDate(request.pickupDate)}`);
  } else if (request.pickupTime) {
    parts.push(`a las ${request.pickupTime}`);
  }

  if (request.originAddress && request.destinationAddress) {
    parts.push(`desde ${request.originAddress} hasta ${request.destinationAddress}`);
  } else if (request.originAddress) {
    parts.push(`desde ${request.originAddress}`);
  } else if (request.destinationAddress) {
    parts.push(`hasta ${request.destinationAddress}`);
  }

  return parts.join(", ");
}

function formatWhatsappDate(date: string) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isoTomorrow = tomorrow.toISOString().slice(0, 10);

  if (date === isoTomorrow) {
    return "mañana";
  }

  return date;
}

function getFirstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

function formatNaturalList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} y ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}
