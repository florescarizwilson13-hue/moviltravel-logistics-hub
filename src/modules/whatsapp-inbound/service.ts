import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { createAiCaptureService } from "@/modules/ai-capture";
import { buildTransferRequestDraft } from "@/modules/transfer-requests";
import type { AiCaptureResult, CreateTransferRequestInput } from "@/types";

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
  const requestInput = withWhatsappContext(analysis.capturedData, payload);
  const request = buildTransferRequestDraft(requestInput);
  const supabase = await createTrustedSupabaseClient();

  const { data, error } = await supabase
    .from("transfer_requests")
    .insert({
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
      metadata: {
        source: "twilio_whatsapp_sandbox",
        from: payload.From ?? null,
        to: payload.To ?? null,
        profileName: payload.ProfileName ?? null,
        messageSid: payload.MessageSid ?? payload.SmsMessageSid ?? null,
        ai: {
          confidence: analysis.confidence,
          extractedFields: analysis.extractedFields,
          missingFields: analysis.missingFields,
          readyForReview: analysis.readyForReview
        }
      }
    })
    .select("id")
    .single<{ id: string }>();

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
    reply: buildWhatsappReply(analysis)
  };
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

function normalizeWhatsappAddress(value: string | undefined) {
  return value?.replace(/^whatsapp:/i, "").trim() || null;
}

function buildWhatsappReply(analysis: AiCaptureResult) {
  if (analysis.readyForReview) {
    return "Gracias. Recibimos los datos mínimos para revisar y coordinar tu traslado.";
  }

  return analysis.assistantMessage;
}
