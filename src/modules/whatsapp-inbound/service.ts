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
  await saveAiConversationAttempt({
    payload,
    requestId,
    analysis,
    reply: analysis.assistantMessage
  });

  return {
    requestId,
    analysis,
    reply: buildWhatsappReply(request)
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
    pickupDate: pickExistingOrCaptured(existingData.pickupDate, capturedData.pickupDate),
    pickupTime: pickExistingOrCaptured(existingData.pickupTime, capturedData.pickupTime),
    pickupAt: pickExistingOrCaptured(existingData.pickupAt, capturedData.pickupAt),
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

  if (completeness.isComplete) {
    return "Gracias. Recibimos los datos mínimos para revisar y coordinar tu traslado.";
  }

  const missingFields = completeness.missingFields.map(
    (field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field
  );
  const fields = missingFields.slice(0, 4).join(", ");

  return `Gracias. Para coordinar el traslado, ¿me indicas ${fields}?`;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}
