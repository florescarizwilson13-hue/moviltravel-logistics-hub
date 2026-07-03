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
import type { WhatsAppInboundMessage } from "@/modules/whatsapp/providers/types";

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

viajes - Ver viajes disponibles
actual - Ver viaje seleccionado
cambiar - Seleccionar otro viaje
1 - Llegué al origen
2 - Salgo con pasajero
3 - Finalicé el servicio
9 - Reportar incidencia

Envía solo el número según el estado del viaje.`;
const driverHelpPatterns = [/^ayuda$/i, /^menu$/i, /^menú$/i, /^comandos$/i, /^\?$/];
const driverTripsListPatterns = [/^viajes$/i, /^mis\s+viajes$/i, /^servicios$/i, /^traslados$/i, /^mv$/i];
const driverCurrentTripPatterns = [/^actual$/i, /^viaje$/i, /^mi\s+viaje$/i];
const driverChangeTripPatterns = [/^cambiar$/i, /^cambiar\s+viaje$/i, /^otro\s+viaje$/i];
const selectingTripTtlMinutes = 10;
const selectedTripTtlHours = 12;
const operableTripsPastWindowHours = 2;
const operableTripsFutureWindowHours = 12;
const maxDriverTripsShown = 5;
const outboundOperationalReply =
  "Mensaje informativo registrado. Si necesitas otro traslado, escríbenos los datos del nuevo servicio.";
const outboundOperationalMessagePatterns = [
  "✅ traslado asignado",
  "🚘 nuevo traslado asignado",
  "conductor asignado",
  "gracias por coordinar con moviltravel"
];
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

type DriverWhatsappSessionRow = {
  id: string;
  driver_id: string;
  whatsapp_from: string;
  selected_transfer_request_id: string | null;
  available_transfer_request_ids: unknown;
  mode: "idle" | "selecting_trip" | "trip_selected";
  expires_at: string | null;
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
  message: WhatsAppInboundMessage
): Promise<WhatsappInboundResult> {
  const body = message.body.trim();

  if (!body) {
    return {
      requestId: null,
      analysis: null,
      reply: "Hola. Envíanos los datos del traslado: pasajero, origen, destino, fecha, hora y cantidad de pasajeros."
    };
  }

  const supabase = await createTrustedSupabaseClient();
  const driverResult = await processDriverTravelCommand(supabase, message, body);

  if (driverResult) {
    return driverResult;
  }

  if (isMoviltravelOutboundOperationalMessage(body)) {
    return {
      requestId: null,
      analysis: null,
      reply: outboundOperationalReply
    };
  }

  const analysis = await aiCaptureService.captureTransferRequest({ message: body });
  const existingRequest = await findLatestOpenWhatsappRequest(supabase, message.from);
  const shouldCreateNewRequest =
    !existingRequest || isNewTransferIntent(body, analysis.capturedData, existingRequest);
  const requestInput = existingRequest
    && !shouldCreateNewRequest
    ? mergeRequestWithCapturedData(existingRequest, analysis.capturedData, message)
    : withWhatsappContext(analysis.capturedData, message);
  const request = buildTransferRequestDraft({
    ...requestInput,
    status: undefined
  });
  const metadata = buildWhatsappMetadata({
    previousMetadata: shouldCreateNewRequest ? undefined : existingRequest?.metadata,
    message,
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
    message,
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

export function isMoviltravelOutboundOperationalMessage(message: string) {
  const normalizedMessage = normalizeTextForOperationalMessageMatch(message);

  return outboundOperationalMessagePatterns.some(
    (pattern) => normalizedMessage.startsWith(pattern) || normalizedMessage.includes(pattern)
  );
}

function normalizeTextForOperationalMessageMatch(message: string) {
  return message.trim().toLocaleLowerCase("es-CL").replace(/\s+/g, " ");
}

async function processDriverTravelCommand(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  message: WhatsAppInboundMessage,
  body: string
): Promise<WhatsappInboundResult | null> {
  const driver = await findActiveDriverByWhatsappFrom(supabase, message.from);

  if (!driver) {
    return null;
  }

  const whatsappFrom = normalizeWhatsappPhone(message.from);

  if (!whatsappFrom) {
    return null;
  }

  const session = await getDriverWhatsappSession(supabase, driver.id, whatsappFrom);

  if (isDriverTripsListRequest(body)) {
    return buildTripsListResult(
      await showDriverTripsForSelection(supabase, driver.id, whatsappFrom)
    );
  }

  if (isDriverCurrentTripRequest(body)) {
    return buildCurrentTripResult(
      await getSelectedDriverTrip(supabase, driver.id, whatsappFrom, session)
    );
  }

  if (isDriverChangeTripRequest(body)) {
    await clearDriverWhatsappSession(supabase, driver.id, whatsappFrom);
    return buildTripsListResult(
      await showDriverTripsForSelection(supabase, driver.id, whatsappFrom)
    );
  }

  if (session?.mode === "selecting_trip" && isTripSelectionReply(body)) {
    return buildTripSelectionResult(
      await selectDriverTripFromSession(supabase, driver.id, whatsappFrom, session, body)
    );
  }

  const command = parseDriverCommand(body);

  if (!command) {
    return {
      requestId: null,
      analysis: null,
      reply: driverCommandHelpReply
    };
  }

  const selectedTrip = await getSelectedDriverTrip(supabase, driver.id, whatsappFrom, session);

  if (selectedTrip.status === "none" || selectedTrip.status === "expired") {
    return {
      requestId: null,
      analysis: null,
      reply: "Primero selecciona un viaje. Escribe “viajes” para ver tus traslados disponibles."
    };
  }

  const eventTime = formatCurrentWhatsappTime();
  const request = selectedTrip.request;
  const actorPhone = whatsappFrom ?? normalizeChileanPhone(driver.phone);
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
    longitude: null,
    location_accuracy: null,
    location_label: null
  });

  if (eventError) {
    throw new Error(`No se pudo registrar el evento de viaje: ${eventError.message}`);
  }

  if (command.nextStatus === "completed") {
    await clearDriverWhatsappSession(supabase, driver.id, whatsappFrom);
  }

  return {
    requestId: request.id,
    analysis: null,
    reply: buildDriverCommandReply(command, eventTime, request)
  };
}

async function findActiveDriverByWhatsappFrom(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  from: string | null | undefined
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

async function listActiveTransfersForDriver(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string
) {
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

  return ((data ?? []) as ActiveDriverTransferRow[]).sort(compareTransfersByProximity);
}

async function listOperableTransfersForDriver(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string
) {
  const trips = await listActiveTransfersForDriver(supabase, driverId);
  const operableTrips = trips.filter(isOperableDriverTrip).sort(compareTransfersBySchedule);

  return {
    trips: operableTrips,
    hasMore: operableTrips.length > maxDriverTripsShown
  };
}

async function getDriverWhatsappSession(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  whatsappFrom: string
) {
  const { data, error } = await supabase
    .from("driver_whatsapp_sessions")
    .select(
      "id, driver_id, whatsapp_from, selected_transfer_request_id, available_transfer_request_ids, mode, expires_at, created_at, updated_at"
    )
    .eq("driver_id", driverId)
    .eq("whatsapp_from", whatsappFrom)
    .maybeSingle<DriverWhatsappSessionRow>();

  if (error) {
    throw new Error(`No se pudo leer la sesión WhatsApp del conductor: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (isExpired(data.expires_at)) {
    await clearDriverWhatsappSession(supabase, driverId, whatsappFrom);
    return null;
  }

  return data;
}

async function showDriverTripsForSelection(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  whatsappFrom: string
) {
  const result = await listOperableTransfersForDriver(supabase, driverId);

  if (result.trips.length === 0) {
    await upsertDriverWhatsappSession(supabase, {
      driverId,
      whatsappFrom,
      mode: "idle",
      selectedTransferRequestId: null,
      availableTransferRequestIds: [],
      expiresAt: null
    });

    return { status: "none" as const };
  }

  const visibleTrips = result.trips.slice(0, maxDriverTripsShown);

  await upsertDriverWhatsappSession(supabase, {
    driverId,
    whatsappFrom,
    mode: "selecting_trip",
    selectedTransferRequestId: null,
    availableTransferRequestIds: visibleTrips.map((trip) => trip.id),
    expiresAt: getFutureIso({ minutes: selectingTripTtlMinutes })
  });

  return { status: "list" as const, trips: visibleTrips, hasMore: result.hasMore };
}

async function selectDriverTripFromSession(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  whatsappFrom: string,
  session: DriverWhatsappSessionRow,
  body: string
) {
  const selectedIndex = Number(body.trim()) - 1;
  const availableIds = getSessionAvailableTransferIds(session);
  const selectedId = availableIds[selectedIndex];

  if (!selectedId) {
    return {
      status: "invalid" as const,
      tripsResult: await showDriverTripsForSelection(supabase, driverId, whatsappFrom)
    };
  }

  const request = await findActiveTransferByIdForDriver(supabase, driverId, selectedId);

  if (!request) {
    return {
      status: "invalid" as const,
      tripsResult: await showDriverTripsForSelection(supabase, driverId, whatsappFrom)
    };
  }

  await upsertDriverWhatsappSession(supabase, {
    driverId,
    whatsappFrom,
    mode: "trip_selected",
    selectedTransferRequestId: request.id,
    availableTransferRequestIds: availableIds,
    expiresAt: getFutureIso({ hours: selectedTripTtlHours })
  });

  return { status: "selected" as const, request };
}

async function getSelectedDriverTrip(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  whatsappFrom: string,
  currentSession: DriverWhatsappSessionRow | null
) {
  const session = currentSession ?? (await getDriverWhatsappSession(supabase, driverId, whatsappFrom));

  if (!session?.selected_transfer_request_id || session.mode !== "trip_selected") {
    return { status: "none" as const };
  }

  const request = await findTransferByIdForDriver(supabase, driverId, session.selected_transfer_request_id);

  if (!request || !activeDriverTripStatuses.includes(request.status)) {
    await clearDriverWhatsappSession(supabase, driverId, whatsappFrom);
    return { status: "expired" as const };
  }

  return { status: "selected" as const, request };
}

async function findActiveTransferByIdForDriver(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  requestId: string
) {
  const request = await findTransferByIdForDriver(supabase, driverId, requestId);
  return request && activeDriverTripStatuses.includes(request.status) ? request : null;
}

async function findTransferByIdForDriver(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  requestId: string
) {
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      "id, passenger_name, origin_address, destination_address, pickup_date, pickup_time, pickup_at, assigned_driver_id, status, created_at, updated_at"
    )
    .eq("id", requestId)
    .eq("assigned_driver_id", driverId)
    .maybeSingle<ActiveDriverTransferRow>();

  if (error) {
    throw new Error(`No se pudo validar el viaje seleccionado: ${error.message}`);
  }

  return data ?? null;
}

async function upsertDriverWhatsappSession(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  input: {
    driverId: string;
    whatsappFrom: string;
    mode: DriverWhatsappSessionRow["mode"];
    selectedTransferRequestId: string | null;
    availableTransferRequestIds: string[];
    expiresAt: string | null;
  }
) {
  const { error } = await supabase.from("driver_whatsapp_sessions").upsert(
    {
      driver_id: input.driverId,
      whatsapp_from: input.whatsappFrom,
      selected_transfer_request_id: input.selectedTransferRequestId,
      available_transfer_request_ids: input.availableTransferRequestIds,
      mode: input.mode,
      expires_at: input.expiresAt
    },
    { onConflict: "driver_id,whatsapp_from" }
  );

  if (error) {
    throw new Error(`No se pudo guardar la sesión WhatsApp del conductor: ${error.message}`);
  }
}

async function clearDriverWhatsappSession(
  supabase: Awaited<ReturnType<typeof createTrustedSupabaseClient>>,
  driverId: string,
  whatsappFrom: string
) {
  await upsertDriverWhatsappSession(supabase, {
    driverId,
    whatsappFrom,
    mode: "idle",
    selectedTransferRequestId: null,
    availableTransferRequestIds: [],
    expiresAt: null
  });
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

function buildTripsListResult(
  result:
    | { status: "none" }
    | { status: "list"; trips: ActiveDriverTransferRow[]; hasMore: boolean }
): WhatsappInboundResult {
  if (result.status === "none") {
    return {
      requestId: null,
      analysis: null,
      reply: "No tienes viajes operables cercanos en este momento."
    };
  }

  return {
    requestId: null,
    analysis: null,
    reply: buildDriverTripsListReply(result.trips, result.hasMore)
  };
}

function buildTripSelectionResult(
  result:
    | { status: "selected"; request: ActiveDriverTransferRow }
    | {
        status: "invalid";
        tripsResult:
          | { status: "none" }
          | { status: "list"; trips: ActiveDriverTransferRow[]; hasMore: boolean };
      }
): WhatsappInboundResult {
  if (result.status === "invalid") {
    return {
      requestId: null,
      analysis: null,
      reply: `La opción no es válida.\n\n${buildTripsListResult(result.tripsResult).reply}`
    };
  }

  return {
    requestId: result.request.id,
    analysis: null,
    reply: `Viaje seleccionado:\n\n${buildDriverTransferSummary(
      result.request
    )}\n\nAhora puedes usar:\n1 - Llegué al origen\n2 - Salgo con pasajero\n3 - Finalicé servicio\n9 - Incidencia`
  };
}

function buildCurrentTripResult(
  result:
    | { status: "none" }
    | { status: "expired" }
    | { status: "selected"; request: ActiveDriverTransferRow }
): WhatsappInboundResult {
  if (result.status !== "selected") {
    return {
      requestId: null,
      analysis: null,
      reply: "No tienes un viaje seleccionado. Escribe “viajes” para elegir uno."
    };
  }

  return {
    requestId: result.request.id,
    analysis: null,
    reply: `Viaje seleccionado actual:\n\n${buildDriverTransferSummary(result.request)}`
  };
}

function buildDriverTripsListReply(trips: ActiveDriverTransferRow[], hasMore = false) {
  const tripLines = trips.map((trip, index) =>
    [`${index + 1}) ${formatDriverTripListHeading(trip)}`, formatDriverTripRoute(trip)].join("\n")
  );
  const extraMessage = hasMore
    ? "\n\nHay más viajes asignados. Contacta a coordinación si no ves el que necesitas."
    : "";

  return `Tus viajes disponibles:\n\n${tripLines.join(
    "\n\n"
  )}${extraMessage}\n\nResponde el número del viaje que vas a operar.`;
}

function formatDriverTripListHeading(request: ActiveDriverTransferRow) {
  return `${formatDriverTripTime(request)} - ${request.passenger_name?.trim() || "Pasajero pendiente"}`;
}

function formatDriverTripTime(request: ActiveDriverTransferRow) {
  return request.pickup_time?.slice(0, 5) ?? formatPickupAtTime(request.pickup_at) ?? "Horario pendiente";
}

function formatPickupAtTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago"
  });
}

function formatDriverTripRoute(request: ActiveDriverTransferRow) {
  const origin = request.origin_address?.trim() || "Origen pendiente";
  const destination = request.destination_address?.trim() || "Destino pendiente";
  return `${origin} → ${destination}`;
}

function buildDriverCommandReply(
  command: DriverCommand,
  eventTime: string,
  request: ActiveDriverTransferRow
) {
  return `${command.reply(
    eventTime
  )}\nUbicación: no recibida por WhatsApp Sandbox.\n\n${buildDriverTransferSummary(request)}`;
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

function isDriverTripsListRequest(body: string) {
  const message = body.trim();
  return driverTripsListPatterns.some((pattern) => pattern.test(message));
}

function isDriverCurrentTripRequest(body: string) {
  const message = body.trim();
  return driverCurrentTripPatterns.some((pattern) => pattern.test(message));
}

function isDriverChangeTripRequest(body: string) {
  const message = body.trim();
  return driverChangeTripPatterns.some((pattern) => pattern.test(message));
}

function isTripSelectionReply(body: string) {
  return /^\d{1,2}$/.test(body.trim());
}

function getSessionAvailableTransferIds(session: DriverWhatsappSessionRow) {
  return Array.isArray(session.available_transfer_request_ids)
    ? session.available_transfer_request_ids.filter((value): value is string => typeof value === "string")
    : [];
}

function isExpired(value: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function getFutureIso(duration: { minutes?: number; hours?: number }) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + (duration.minutes ?? 0));
  date.setHours(date.getHours() + (duration.hours ?? 0));
  return date.toISOString();
}

function normalizeWhatsappPhone(value: string | null | undefined) {
  return normalizeChileanPhone(normalizeWhatsappAddress(value));
}

function isOperableDriverTrip(request: ActiveDriverTransferRow) {
  if (["driver_at_pickup", "passenger_on_board", "incident"].includes(request.status)) {
    return true;
  }

  const scheduleTime = getTransferScheduleTime(request);

  if (!scheduleTime) {
    return false;
  }

  const now = Date.now();
  const windowStart = now - operableTripsPastWindowHours * 60 * 60 * 1000;
  const windowEnd = now + operableTripsFutureWindowHours * 60 * 60 * 1000;

  if (scheduleTime >= windowStart && scheduleTime <= windowEnd) {
    return true;
  }

  return request.status === "assigned" && scheduleTime >= windowStart && isTodayOrTomorrowTrip(request);
}

function compareTransfersBySchedule(first: ActiveDriverTransferRow, second: ActiveDriverTransferRow) {
  return getTransferScheduleTime(first) - getTransferScheduleTime(second);
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

function isTodayOrTomorrowTrip(request: ActiveDriverTransferRow) {
  const serviceDateKey = getTransferServiceDateKey(request);

  if (!serviceDateKey) {
    return false;
  }

  const today = getChileDateKey(new Date());
  const tomorrow = getChileDateKey(addDays(new Date(), 1));

  return serviceDateKey === today || serviceDateKey === tomorrow;
}

function getTransferServiceDateKey(request: ActiveDriverTransferRow) {
  if (request.pickup_date) {
    return request.pickup_date.slice(0, 10);
  }

  if (!request.pickup_at) {
    return null;
  }

  const date = new Date(request.pickup_at);
  return Number.isNaN(date.getTime()) ? null : getChileDateKey(date);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getChileDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santiago"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
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
  from: string | null | undefined
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
  message: WhatsAppInboundMessage;
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
      source_reference: input.message.providerMessageId ?? input.message.from ?? null,
      captured_data: input.analysis.capturedData,
      missing_fields: input.analysis.missingFields,
      confidence: input.analysis.confidence,
      messages: [
        {
          role: "user",
          content: input.message.body,
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
        provider: input.message.provider,
        from: input.message.from ?? null,
        to: input.message.to ?? null,
        profileName: input.message.profileName ?? null
      }
    });
  } catch {
    // Request creation is the durable intake path; conversation storage is best-effort here.
  }
}

function withWhatsappContext(
  capturedData: CreateTransferRequestInput,
  message: WhatsAppInboundMessage
): CreateTransferRequestInput {
  const sourceLines = [
    "Origen solicitud: WhatsApp Twilio Sandbox",
    message.profileName ? `Perfil WhatsApp: ${message.profileName}` : null,
    message.from ? `Desde: ${message.from}` : null,
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
  message: WhatsAppInboundMessage
): CreateTransferRequestInput {
  const existingData = mapTransferRequestRowToInput(existingRequest);
  const nextData = applyShortPassengerNameFallback({
    existingData,
    message: message.body,
    mergedData: mergeEmptyFields(existingData, capturedData, existingRequest)
  });
  const withContext = withWhatsappContext(nextData, message);

  return {
    ...withContext,
    notes: appendUniqueNotes(withContext.notes, capturedData.notes)
  };
}

function applyShortPassengerNameFallback(input: {
  existingData: CreateTransferRequestInput;
  message: string;
  mergedData: CreateTransferRequestInput;
}) {
  if (input.existingData.passengerName) {
    return input.mergedData;
  }

  const missingAfterMerge = getTransferRequestCompleteness(input.mergedData).missingFields;

  if (missingAfterMerge.length !== 1 || missingAfterMerge[0] !== "passengerName") {
    return input.mergedData;
  }

  const passengerName = extractPassengerNameFollowUp(input.message);

  if (!passengerName) {
    return input.mergedData;
  }

  return {
    ...input.mergedData,
    passengerName
  };
}

function extractPassengerNameFollowUp(message: string) {
  const explicitName = matchPassengerNameFollowUp(message);

  if (explicitName) {
    return formatPersonName(explicitName);
  }

  if (!isShortPassengerNameMessage(message)) {
    return null;
  }

  return formatPersonName(message);
}

function matchPassengerNameFollowUp(message: string) {
  return (
    matchFirstText(message, /\bnombre\s+pasajero\s+(.+?)(?:[.,;\n]|$)/iu) ??
    matchFirstText(message, /\bel\s+pasajero\s+es\s+(.+?)(?:[.,;\n]|$)/iu) ??
    matchFirstText(message, /(?:^|[.,;\n]\s*)pasajero\s+(.+?)(?:[.,;\n]|$)/iu)
  );
}

function isShortPassengerNameMessage(message: string) {
  const cleanMessage = message.trim();

  if (!cleanMessage || cleanMessage.length > 60) {
    return false;
  }

  if (newTransferIntentPatterns.some((pattern) => pattern.test(cleanMessage))) {
    return false;
  }

  if (
    /\b(?:desde|hasta|origen|destino|empresa|solicitante|tel[eé]fono|telefono|fono|celular|fecha|hora|mañana|pasajer[oa]s?)\b/iu.test(
      cleanMessage
    )
  ) {
    return false;
  }

  if (/\+?\d[\d\s-]{6,}/.test(cleanMessage) || /\b\d{1,2}:\d{2}\b/.test(cleanMessage)) {
    return false;
  }

  return /^[\p{L}ÁÉÍÓÚÑáéíóúñ]+(?:[\s'-]+[\p{L}ÁÉÍÓÚÑáéíóúñ]+){1,4}$/u.test(
    cleanMessage
  );
}

function matchFirstText(message: string, pattern: RegExp) {
  const match = message.match(pattern);
  return match?.[1]?.trim();
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
  message: WhatsAppInboundMessage;
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
    messageSid: input.message.providerMessageId ?? null,
    receivedAt: now
  };

  return {
    ...(input.previousMetadata ?? {}),
    source: "twilio_whatsapp_sandbox",
    whatsapp_provider: input.message.provider,
    whatsapp_from: input.message.from ?? null,
    whatsapp_to: input.message.to ?? null,
    whatsapp_profile_name: input.message.profileName ?? null,
    whatsapp_location: input.message.location ?? null,
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

function normalizeWhatsappAddress(value: string | null | undefined) {
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
