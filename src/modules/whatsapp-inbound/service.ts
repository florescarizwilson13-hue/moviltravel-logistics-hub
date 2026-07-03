import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  formatPersonName,
  normalizeChileanPhone
} from "@/lib/formatters/operational-data";
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
const collectingWhatsappStatuses: TransferRequestStatus[] = ["draft", "incomplete"];
const activeDriverTripStatuses: TransferRequestStatus[] = [
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "incident"
];
const driverCommandHelpReply = `Comandos del viaje:

1 - Llegué al origen
2 - Salgo con pasajero
3 - Finalicé el servicio
9 - Reportar incidencia

Envía solo el número según el estado del viaje.`;
const driverHelpPatterns = [/^ayuda$/i, /^menu$/i, /^menú$/i, /^comandos$/i, /^\?$/];
const newTransferIntentPatterns = [
  /\bnecesito\s+(?:un\s+)?traslado\b/i,
  /\bnuevo\s+traslado\b/i,
  /\bsolicito\s+(?:un\s+)?traslado\b/i
];
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

type DriverLookupRow = {
  id: string;
  full_name: string;
  phone: string | null;
  availability: string;
};

type ActiveDriverTransferRow = {
  id: string;
  passenger_name: string | null;
  origin_address: string | null;
  destination_address: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_at: string | null;
  assigned_driver_id: string | null;
  status: TransferRequestStatus;
  created_at: string;
  updated_at: string;
};

type DriverCommand = {
  command: "1" | "2" | "3" | "9";
  eventType: "driver_at_pickup" | "passenger_on_board" | "completed" | "incident";
  nextStatus: Extract<
    TransferRequestStatus,
    "driver_at_pickup" | "passenger_on_board" | "completed" | "incident"
  >;
  reply: (time: string) => string;
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

  const supabase = await createTrustedSupabaseClient();
  const driverResult = await processDriverTravelCommand(supabase, payload, body);

  if (driverResult) {
    return driverResult;
  }

  const analysis = await aiCaptureService.captureTransferRequest({ message: body });
  const existingRequest = await findLatestOpenWhatsappRequest(supabase, payload.From);
  const shouldCreateNewRequest =
    !existingRequest || isNewTransferIntent(body, analysis.capturedData, existingRequest);
  const requestInput = existingRequest
    && !shouldCreateNewRequest
    ? mergeRequestWithCapturedData(existingRequest, analysis.capturedData, payload)
    : withWhatsappContext(analysis.capturedData, payload);
  const request = buildTransferRequestDraft({
    ...requestInput,
    status: undefined
  });
  const metadata = buildWhatsappMetadata({
    previousMetadata: shouldCreateNewRequest ? undefined : existingRequest?.metadata,
    payload,
    analysis,
    body,
    request
  });

  const write = existingRequest && !shouldCreateNewRequest
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

async function processDriverTravelCommand(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  payload: TwilioWhatsappInboundPayload,
  body: string
): Promise<WhatsappInboundResult | null> {
  const driver = await findActiveDriverByWhatsappFrom(supabase, payload.From);

  if (!driver) {
    return null;
  }

  const command = parseDriverCommand(body);

  if (!command) {
    return {
      requestId: null,
      analysis: null,
      reply: driverCommandHelpReply
    };
  }

  const activeTransfer = await findActiveTransferForDriver(supabase, driver.id);

  if (activeTransfer.status === "none") {
    return {
      requestId: null,
      analysis: null,
      reply: "No encontramos un traslado activo asignado a tu teléfono. Contacta a coordinación."
    };
  }

  if (activeTransfer.status === "ambiguous") {
    return {
      requestId: null,
      analysis: null,
      reply: "Tienes más de un traslado activo con horario similar. Contacta a coordinación para registrar el avance."
    };
  }

  const eventTime = formatCurrentWhatsappTime();
  const request = activeTransfer.request;
  const actorPhone = normalizeWhatsappPhone(payload.From) ?? normalizeChileanPhone(driver.phone);
  const { error: updateError } = await supabase
    .from("transfer_requests")
    .update({ status: command.nextStatus })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`No se pudo actualizar el estado del traslado: ${updateError.message}`);
  }

  const { error: eventError } = await supabase.from("travel_events").insert({
    transfer_request_id: request.id,
    type: command.eventType,
    source: "whatsapp_driver",
    actor_type: "driver",
    actor_name: formatPersonName(driver.full_name),
    actor_phone: actorPhone,
    message_body: body,
    latitude: null,
    longitude: null
  });

  if (eventError) {
    throw new Error(`No se pudo registrar el evento de viaje: ${eventError.message}`);
  }

  return {
    requestId: request.id,
    analysis: null,
    reply: buildDriverCommandReply(command, eventTime, request)
  };
}

async function findActiveDriverByWhatsappFrom(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  from: string | undefined
) {
  const fromPhone = normalizeWhatsappPhone(from);

  if (!fromPhone) {
    return null;
  }

  const { data, error } = await supabase
    .from("drivers")
    .select("id, full_name, phone, availability")
    .neq("availability", "inactive");

  if (error) {
    throw new Error(`No se pudo validar el conductor: ${error.message}`);
  }

  return (
    ((data ?? []) as DriverLookupRow[]).find(
      (driver) => normalizeChileanPhone(driver.phone) === fromPhone
    ) ?? null
  );
}

async function findActiveTransferForDriver(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string
): Promise<
  | { status: "none" }
  | { status: "ambiguous" }
  | { status: "found"; request: ActiveDriverTransferRow }
> {
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      "id, passenger_name, origin_address, destination_address, pickup_date, pickup_time, pickup_at, assigned_driver_id, status, created_at, updated_at"
    )
    .eq("assigned_driver_id", driverId)
    .in("status", activeDriverTripStatuses);

  if (error) {
    throw new Error(`No se pudo buscar el traslado activo del conductor: ${error.message}`);
  }

  const candidates = ((data ?? []) as ActiveDriverTransferRow[]).sort(compareTransfersByProximity);

  if (candidates.length === 0) {
    return { status: "none" };
  }

  if (
    candidates.length > 1 &&
    getTransferScheduleKey(candidates[0]) === getTransferScheduleKey(candidates[1])
  ) {
    return { status: "ambiguous" };
  }

  return { status: "found", request: candidates[0] };
}

function parseDriverCommand(body: string): DriverCommand | null {
  if (isDriverHelpRequest(body)) {
    return null;
  }

  const command = body.trim().match(/^[1239]\b/)?.[0] as DriverCommand["command"] | undefined;

  if (!command) {
    return null;
  }

  const commands: Record<DriverCommand["command"], DriverCommand> = {
    "1": {
      command: "1",
      eventType: "driver_at_pickup",
      nextStatus: "driver_at_pickup",
      reply: (time) => `Registrado: llegaste al punto de origen a las ${time}.`
    },
    "2": {
      command: "2",
      eventType: "passenger_on_board",
      nextStatus: "passenger_on_board",
      reply: (time) => `Registrado: saliste con el pasajero a las ${time}.`
    },
    "3": {
      command: "3",
      eventType: "completed",
      nextStatus: "completed",
      reply: (time) => `Registrado: servicio finalizado a las ${time}.`
    },
    "9": {
      command: "9",
      eventType: "incident",
      nextStatus: "incident",
      reply: (time) => `Incidencia registrada a las ${time}.`
    }
  };

  return commands[command];
}

function buildDriverCommandReply(
  command: DriverCommand,
  eventTime: string,
  request: ActiveDriverTransferRow
) {
  return `${command.reply(eventTime)}\n\n${buildDriverTransferSummary(request)}`;
}

function buildDriverTransferSummary(request: ActiveDriverTransferRow) {
  return [
    "Traslado:",
    `Pasajero: ${request.passenger_name?.trim() || "Pasajero pendiente"}`,
    `Origen: ${request.origin_address?.trim() || "Origen pendiente"}`,
    `Destino: ${request.destination_address?.trim() || "Destino pendiente"}`,
    `Horario: ${formatDriverTransferSchedule(request)}`
  ].join("\n");
}

function formatDriverTransferSchedule(request: ActiveDriverTransferRow) {
  const date = request.pickup_date ? formatChileanDate(request.pickup_date) : null;
  const time = request.pickup_time?.slice(0, 5) ?? null;

  if (date && time) {
    return `${date} ${time}`;
  }

  if (request.pickup_at) {
    return formatPickupAtForDriver(request.pickup_at);
  }

  return date ?? time ?? "Horario pendiente";
}

function formatChileanDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function formatPickupAtForDriver(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const datePart = date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago"
  });
  const timePart = date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago"
  });

  return `${datePart.replaceAll("-", "/")} ${timePart}`;
}

function isDriverHelpRequest(body: string) {
  const message = body.trim();
  return driverHelpPatterns.some((pattern) => pattern.test(message));
}

function normalizeWhatsappPhone(value: string | undefined) {
  return normalizeChileanPhone(normalizeWhatsappAddress(value));
}

function compareTransfersByProximity(first: ActiveDriverTransferRow, second: ActiveDriverTransferRow) {
  const now = Date.now();
  return Math.abs(getTransferScheduleTime(first) - now) - Math.abs(getTransferScheduleTime(second) - now);
}

function getTransferScheduleTime(request: ActiveDriverTransferRow) {
  const value =
    request.pickup_at ??
    (request.pickup_date && request.pickup_time
      ? `${request.pickup_date}T${request.pickup_time}`
      : request.pickup_date) ??
    request.updated_at ??
    request.created_at;
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getTransferScheduleKey(request: ActiveDriverTransferRow) {
  return request.pickup_at ?? `${request.pickup_date ?? ""} ${request.pickup_time ?? ""}`.trim();
}

function formatCurrentWhatsappTime() {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago"
  }).format(new Date());
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
    .in("status", collectingWhatsappStatuses)
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
  const sourceLines = [
    "Origen solicitud: WhatsApp Twilio Sandbox",
    payload.ProfileName ? `Perfil WhatsApp: ${payload.ProfileName}` : null,
    payload.From ? `Desde: ${payload.From}` : null,
    capturedData.notes
  ].filter(Boolean);

  return {
    ...capturedData,
    notes: sourceLines.join("\n")
  };
}

function mergeRequestWithCapturedData(
  existingRequest: TransferRequestIntakeRow,
  capturedData: CreateTransferRequestInput,
  payload: TwilioWhatsappInboundPayload
): CreateTransferRequestInput {
  const existingData = mapTransferRequestRowToInput(existingRequest);
  const nextData = mergeEmptyFields(existingData, capturedData, existingRequest);
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
  capturedData: CreateTransferRequestInput,
  existingRequest?: TransferRequestIntakeRow
) {
  const shouldReplaceDateTime = Boolean(capturedData.pickupDate || capturedData.pickupTime);
  const shouldReplaceRequesterName = shouldUseCapturedRequesterName(
    existingData.requesterName,
    capturedData.requesterName,
    existingRequest
  );
  const shouldReplaceRequesterPhone = shouldUseCapturedRequesterPhone(
    existingData.requesterPhone,
    capturedData.requesterPhone,
    existingRequest
  );

  return {
    ...existingData,
    companyName: pickExistingOrCaptured(existingData.companyName, capturedData.companyName),
    requesterName: shouldReplaceRequesterName
      ? capturedData.requesterName ?? existingData.requesterName
      : pickExistingOrCaptured(existingData.requesterName, capturedData.requesterName),
    requesterPhone: shouldReplaceRequesterPhone
      ? capturedData.requesterPhone ?? existingData.requesterPhone
      : pickExistingOrCaptured(existingData.requesterPhone, capturedData.requesterPhone),
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

function shouldUseCapturedRequesterName(
  existingValue: string | null | undefined,
  capturedValue: string | null | undefined,
  existingRequest: TransferRequestIntakeRow | undefined
) {
  if (!capturedValue) {
    return false;
  }

  if (!existingValue) {
    return true;
  }

  const profileName = getMetadataString(existingRequest?.metadata, [
    "whatsapp_profile_name",
    "profileName"
  ]);

  return (
    normalizeComparable(existingValue) === normalizeComparable(profileName) ||
    isMoreCompleteName(existingValue, capturedValue)
  );
}

function shouldUseCapturedRequesterPhone(
  existingValue: string | null | undefined,
  capturedValue: string | null | undefined,
  existingRequest: TransferRequestIntakeRow | undefined
) {
  if (!capturedValue) {
    return false;
  }

  if (!existingValue) {
    return true;
  }

  const whatsappFrom = getMetadataString(existingRequest?.metadata, ["whatsapp_from", "from"]);
  return normalizePhone(existingValue) === normalizePhone(whatsappFrom);
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function isMoreCompleteName(existingValue: string, capturedValue: string) {
  const existing = normalizeComparable(existingValue);
  const captured = normalizeComparable(capturedValue);
  return captured.startsWith(`${existing} `) && captured.split(/\s+/).length > existing.split(/\s+/).length;
}

function normalizePhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
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
  request: ReturnType<typeof buildTransferRequestDraft>;
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
    conversation_status: input.request.completeness.isComplete ? "ready_for_review" : "collecting",
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

function isNewTransferIntent(
  message: string,
  capturedData: CreateTransferRequestInput,
  existingRequest: TransferRequestIntakeRow
) {
  const existingData = mapTransferRequestRowToInput(existingRequest);
  const hasExplicitTransferPhrase = newTransferIntentPatterns.some((pattern) =>
    pattern.test(message)
  );
  const hasRoute = Boolean(capturedData.originAddress && capturedData.destinationAddress);
  const hasDifferentPassenger = Boolean(
    capturedData.passengerName &&
      existingData.passengerName &&
      normalizeComparable(capturedData.passengerName) !==
        normalizeComparable(existingData.passengerName)
  );

  return hasDifferentPassenger || hasRoute || hasExplicitTransferPhrase;
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

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
