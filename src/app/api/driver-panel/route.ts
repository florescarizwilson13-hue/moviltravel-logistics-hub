import { NextResponse } from "next/server";
import { normalizeChileanPhone } from "@/lib/formatters/operational-data";
import { TRANSFER_REQUEST_STATUS_LABELS } from "@/lib/constants/statuses";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { TransferRequestStatus } from "@/types";

const activeDriverTripStatuses: TransferRequestStatus[] = [
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "incident"
];
const operableTripsPastWindowHours = 2;
const operableTripsFutureWindowHours = 12;

type DriverPanelDriverRow = {
  id: string;
  full_name: string;
  phone: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
  vehicle_capacity: number | null;
  availability: string;
};

type DriverPanelTransferRow = {
  id: string;
  passenger_name: string | null;
  passenger_phone: string | null;
  origin_address: string | null;
  destination_address: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_at: string | null;
  passenger_count: number | null;
  assigned_driver_id: string | null;
  status: TransferRequestStatus;
  created_at: string;
  updated_at: string;
};

type DriverPanelAction = "driver_at_pickup" | "passenger_on_board" | "completed" | "incident";

export async function GET(request: Request) {
  try {
    const phone = new URL(request.url).searchParams.get("phone");
    const driver = await findDriverByPhone(phone);

    if (!driver) {
      return NextResponse.json({
        driver: null,
        trips: [],
        message: "No encontramos un conductor activo para este teléfono."
      });
    }

    const trips = await listOperableDriverTrips(driver.id);

    return NextResponse.json({
      driver: mapDriver(driver),
      trips: trips.map(mapTrip)
    });
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar el panel del conductor."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      requestId?: string;
      action?: DriverPanelAction;
      location?: {
        latitude?: number;
        longitude?: number;
        accuracy?: number | null;
        label?: string | null;
      } | null;
    };
    const driver = await findDriverByPhone(body.phone);

    if (!driver) {
      return NextResponse.json(
        { error: "No encontramos un conductor activo para este teléfono." },
        { status: 404 }
      );
    }

    const action = parseDriverPanelAction(body.action);

    if (!action || !body.requestId) {
      return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
    }

    const transfer = await findDriverTransfer(driver.id, body.requestId);

    if (!transfer) {
      return NextResponse.json(
        { error: "No encontramos este viaje activo para el conductor." },
        { status: 404 }
      );
    }

    if (!isActionAllowedForStatus(action.nextStatus, transfer.status)) {
      return NextResponse.json(
        { error: "Este hito no corresponde al estado actual del viaje." },
        { status: 409 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("transfer_requests")
      .update({ status: action.nextStatus, updated_at: now })
      .eq("id", transfer.id)
      .eq("assigned_driver_id", driver.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar el viaje: ${updateError.message}`);
    }

    const location = normalizeBrowserLocation(body.location);
    const { error: eventError } = await supabase.from("travel_events").insert({
      transfer_request_id: transfer.id,
      type: action.eventType,
      source: "driver_panel",
      actor_type: "driver",
      actor_name: driver.full_name,
      actor_phone: normalizeChileanPhone(driver.phone),
      message_body: action.messageBody,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      location_accuracy: location?.accuracy ?? null,
      location_label: location?.label ?? null
    });

    if (eventError) {
      throw new Error(`No se pudo registrar el hito: ${eventError.message}`);
    }

    const updatedTransfer = {
      ...transfer,
      status: action.nextStatus,
      updated_at: now
    };

    return NextResponse.json({
      message: "Hito registrado correctamente.",
      trip: mapTrip(updatedTransfer)
    });
  } catch (caught) {
    return NextResponse.json(
      {
        error: caught instanceof Error ? caught.message : "No se pudo registrar el hito."
      },
      { status: 500 }
    );
  }
}

async function findDriverByPhone(phone: string | null | undefined) {
  const normalizedPhone = normalizeChileanPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("drivers")
    .select("id, full_name, phone, vehicle_name, vehicle_plate, vehicle_capacity, availability")
    .neq("availability", "inactive");

  if (error) {
    throw new Error(`No se pudo buscar el conductor: ${error.message}`);
  }

  return (
    ((data ?? []) as DriverPanelDriverRow[]).find(
      (driver) => normalizeChileanPhone(driver.phone) === normalizedPhone
    ) ?? null
  );
}

async function listOperableDriverTrips(driverId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      "id, passenger_name, passenger_phone, origin_address, destination_address, pickup_date, pickup_time, pickup_at, passenger_count, assigned_driver_id, status, created_at, updated_at"
    )
    .eq("assigned_driver_id", driverId)
    .in("status", activeDriverTripStatuses);

  if (error) {
    throw new Error(`No se pudieron cargar los viajes del conductor: ${error.message}`);
  }

  return ((data ?? []) as DriverPanelTransferRow[])
    .filter(isOperableDriverTrip)
    .sort(compareTripsBySchedule);
}

async function findDriverTransfer(driverId: string, requestId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      "id, passenger_name, passenger_phone, origin_address, destination_address, pickup_date, pickup_time, pickup_at, passenger_count, assigned_driver_id, status, created_at, updated_at"
    )
    .eq("id", requestId)
    .eq("assigned_driver_id", driverId)
    .in("status", activeDriverTripStatuses)
    .maybeSingle<DriverPanelTransferRow>();

  if (error) {
    throw new Error(`No se pudo validar el viaje: ${error.message}`);
  }

  return data;
}

function parseDriverPanelAction(action: DriverPanelAction | undefined) {
  const actions: Record<
    DriverPanelAction,
    {
      eventType: DriverPanelAction;
      nextStatus: DriverPanelAction;
      messageBody: string;
    }
  > = {
    driver_at_pickup: {
      eventType: "driver_at_pickup",
      nextStatus: "driver_at_pickup",
      messageBody: "Llegada al origen registrada desde panel conductor"
    },
    passenger_on_board: {
      eventType: "passenger_on_board",
      nextStatus: "passenger_on_board",
      messageBody: "Salida con pasajero registrada desde panel conductor"
    },
    completed: {
      eventType: "completed",
      nextStatus: "completed",
      messageBody: "Servicio finalizado desde panel conductor"
    },
    incident: {
      eventType: "incident",
      nextStatus: "incident",
      messageBody: "Incidencia reportada desde panel conductor"
    }
  };

  return action ? actions[action] ?? null : null;
}

function isActionAllowedForStatus(nextStatus: DriverPanelAction, currentStatus: TransferRequestStatus) {
  if (nextStatus === "incident") {
    return activeDriverTripStatuses.includes(currentStatus);
  }

  const allowedTransitions: Partial<Record<TransferRequestStatus, DriverPanelAction>> = {
    assigned: "driver_at_pickup",
    driver_at_pickup: "passenger_on_board",
    passenger_on_board: "completed"
  };

  return allowedTransitions[currentStatus] === nextStatus;
}

function normalizeBrowserLocation(
  location:
    | {
        latitude?: number;
        longitude?: number;
        accuracy?: number | null;
        label?: string | null;
      }
    | null
    | undefined
) {
  if (
    typeof location?.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    Number.isNaN(location.latitude) ||
    Number.isNaN(location.longitude)
  ) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy:
      typeof location.accuracy === "number" && !Number.isNaN(location.accuracy)
        ? location.accuracy
        : null,
    label: location.label?.trim() || null
  };
}

function isOperableDriverTrip(request: DriverPanelTransferRow) {
  if (["driver_at_pickup", "passenger_on_board", "incident"].includes(request.status)) {
    return true;
  }

  const scheduleTime = getTripScheduleTime(request);

  if (!scheduleTime) {
    return false;
  }

  const now = Date.now();
  const windowStart = now - operableTripsPastWindowHours * 60 * 60 * 1000;
  const windowEnd = now + operableTripsFutureWindowHours * 60 * 60 * 1000;

  return scheduleTime >= windowStart && scheduleTime <= windowEnd;
}

function compareTripsBySchedule(first: DriverPanelTransferRow, second: DriverPanelTransferRow) {
  return getTripScheduleTime(first) - getTripScheduleTime(second);
}

function getTripScheduleTime(request: DriverPanelTransferRow) {
  if (request.pickup_at) {
    const pickupAtTime = new Date(request.pickup_at).getTime();

    if (!Number.isNaN(pickupAtTime)) {
      return pickupAtTime;
    }
  }

  if (request.pickup_date && request.pickup_time) {
    const dateTime = new Date(`${request.pickup_date}T${request.pickup_time}`).getTime();

    if (!Number.isNaN(dateTime)) {
      return dateTime;
    }
  }

  if (request.pickup_date) {
    const dateTime = new Date(`${request.pickup_date}T00:00:00`).getTime();

    if (!Number.isNaN(dateTime)) {
      return dateTime;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

function mapDriver(driver: DriverPanelDriverRow) {
  return {
    id: driver.id,
    fullName: driver.full_name,
    phone: normalizeChileanPhone(driver.phone) ?? driver.phone,
    vehicleName: driver.vehicle_name,
    vehiclePlate: driver.vehicle_plate,
    vehicleCapacity: driver.vehicle_capacity,
    availability: driver.availability
  };
}

function mapTrip(request: DriverPanelTransferRow) {
  return {
    id: request.id,
    passengerName: request.passenger_name,
    passengerPhone: request.passenger_phone,
    originAddress: request.origin_address,
    destinationAddress: request.destination_address,
    pickupDate: request.pickup_date,
    pickupTime: request.pickup_time?.slice(0, 5) ?? null,
    pickupAt: request.pickup_at,
    passengerCount: request.passenger_count,
    status: request.status,
    statusLabel: TRANSFER_REQUEST_STATUS_LABELS[request.status],
    scheduleLabel: formatTripSchedule(request)
  };
}

function formatTripSchedule(request: DriverPanelTransferRow) {
  const date = request.pickup_date ? formatChileanDate(request.pickup_date) : null;
  const time = request.pickup_time?.slice(0, 5) ?? null;

  if (date && time) {
    return `${date} ${time}`;
  }

  if (request.pickup_at) {
    return formatPickupAt(request.pickup_at);
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

function formatPickupAt(value: string) {
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
