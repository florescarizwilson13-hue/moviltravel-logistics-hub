import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  formatDisplayName,
  formatPersonName,
  normalizeChileanPhone,
  normalizeVehiclePlate
} from "@/lib/formatters/operational-data";
import { buildDashboardOverview } from "@/modules/dashboard";
import { prepareAssignmentWhatsappMessages } from "@/modules/messaging";
import {
  assignDriverToTransferRequest,
  buildTransferRequestDraft,
  markTransferRequestReadyToAssign,
  normalizeTransferRequestInput,
  refreshTransferRequestStatus
} from "@/modules/transfer-requests";
import { createLocalRepositories } from "../local";
import type { LogisticsRepositories, LogisticsSnapshot } from "../types";
import type {
  CreateDriverInput,
  CreateTransferRequestInput,
  CommunicationEvent,
  CreateCommunicationEventInput,
  Driver,
  DriverAvailability,
  GeneratedWhatsappMessage,
  RequestMessage,
  TransferRequest,
  TransferRequestStatus
} from "@/types";

type DriverRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
  vehicle_capacity: number | null;
  availability: DriverAvailability;
  is_seed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TransferRequestRow = {
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
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RequestMessageRow = {
  id: string;
  transfer_request_id: string;
  channel: RequestMessage["channel"];
  template: RequestMessage["template"];
  recipient_name: string | null;
  recipient_phone: string | null;
  body: string;
  status: RequestMessage["status"];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type CommunicationEventRow = {
  id: string;
  transfer_request_id: string;
  type: CommunicationEvent["type"];
  channel: CommunicationEvent["channel"];
  recipient_type: CommunicationEvent["recipientType"];
  recipient_name: string | null;
  recipient_phone: string | null;
  message_body: string | null;
  created_by: string | null;
  created_at: string;
};

const driverSelect =
  "id, full_name, phone, email, license_number, vehicle_name, vehicle_plate, vehicle_capacity, availability, is_seed, notes, created_at, updated_at";

const transferRequestSelect =
  "id, company_id, company_name, requester_name, requester_phone, requester_email, passenger_name, passenger_phone, origin_address, destination_address, pickup_date, pickup_time, pickup_at, passenger_count, cargo_description, special_requirements, notes, assigned_driver_id, assigned_vehicle_id, status, metadata, created_at, updated_at";

const requestMessageSelect =
  "id, transfer_request_id, channel, template, recipient_name, recipient_phone, body, status, metadata, created_at, updated_at";

const communicationEventSelect =
  "id, transfer_request_id, type, channel, recipient_type, recipient_name, recipient_phone, message_body, created_by, created_at";

function notImplemented(operation: string): never {
  throw new Error(
    `Supabase repository "${operation}" is not connected yet. Keep using NEXT_PUBLIC_PERSISTENCE_PROVIDER=local for this module.`
  );
}

function mapDriverRow(row: DriverRow): Driver {
  return {
    id: row.id,
    fullName: formatPersonName(row.full_name),
    phone: normalizeChileanPhone(row.phone),
    email: row.email,
    licenseNumber: row.license_number,
    vehicleName: row.vehicle_name ? formatDisplayName(row.vehicle_name) : row.vehicle_name,
    vehiclePlate: normalizeVehiclePlate(row.vehicle_plate),
    vehicleCapacity: row.vehicle_capacity,
    availability: row.availability,
    isSeed: row.is_seed,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDriverInput(input: CreateDriverInput) {
  return {
    full_name: formatPersonName(input.fullName),
    phone: normalizeChileanPhone(input.phone),
    email: input.email ?? null,
    license_number: input.licenseNumber ?? null,
    vehicle_name: input.vehicleName ? formatDisplayName(input.vehicleName) : null,
    vehicle_plate: normalizeVehiclePlate(input.vehiclePlate),
    vehicle_capacity: input.vehicleCapacity ?? null,
    availability: input.availability ?? "available",
    is_seed: false,
    notes: input.notes ?? null
  };
}

function mapTransferRequestRow(row: TransferRequestRow): TransferRequest {
  return {
    id: row.id,
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
    metadata: row.metadata ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRequestMessageRow(row: RequestMessageRow): RequestMessage {
  const manualStatus = row.metadata?.manual_status;

  return {
    id: row.id,
    transferRequestId: row.transfer_request_id,
    channel: row.channel,
    template: row.template,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    body: row.body,
    status: manualStatus === "copied" && row.status === "generated" ? "copied" : row.status,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCommunicationEventRow(row: CommunicationEventRow): CommunicationEvent {
  return {
    id: row.id,
    transferRequestId: row.transfer_request_id,
    type: row.type,
    channel: row.channel,
    recipientType: row.recipient_type,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    messageBody: row.message_body,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapTransferRequestForWrite(input: CreateTransferRequestInput) {
  return {
    company_id: input.companyId ?? null,
    company_name: input.companyName ?? null,
    requester_name: input.requesterName ?? null,
    requester_phone: input.requesterPhone ?? null,
    requester_email: input.requesterEmail ?? null,
    passenger_name: input.passengerName ?? null,
    passenger_phone: input.passengerPhone ?? null,
    origin_address: input.originAddress ?? null,
    destination_address: input.destinationAddress ?? null,
    pickup_date: input.pickupDate ?? null,
    pickup_time: input.pickupTime ?? null,
    pickup_at: input.pickupAt ?? null,
    passenger_count: input.passengerCount ?? null,
    cargo_description: input.cargoDescription ?? null,
    special_requirements: input.specialRequirements ?? null,
    notes: input.notes ?? null,
    assigned_driver_id: input.assignedDriverId ?? null,
    assigned_vehicle_id: input.assignedVehicleId ?? null,
    status: input.status
  };
}

function mapTransferRequestForUpdate(request: TransferRequest) {
  return {
    ...mapTransferRequestForWrite(request),
    status: request.status
  };
}

function formatSupabaseError(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("auth")) {
    return new Error(`No hay una sesión válida para ${operation}. Inicia sesión nuevamente.`);
  }

  if (
    message.toLowerCase().includes("row-level security") ||
    message.toLowerCase().includes("permission denied") ||
    message.toLowerCase().includes("violates row-level security")
  ) {
    return new Error(
      `Tu usuario no tiene permisos para ${operation}. Revisa el rol en Supabase Auth.`
    );
  }

  if (
    message.toLowerCase().includes("foreign key") ||
    message.toLowerCase().includes("violates foreign key constraint")
  ) {
    return new Error(
      `No se pudo ${operation} porque está relacionado con otros registros. Desactívalo en lugar de eliminarlo.`
    );
  }

  return new Error(`No se pudo ${operation}: ${message}`);
}

async function listSupabaseDrivers() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("drivers")
    .select(
      driverSelect
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw formatSupabaseError("listar conductores", error);
  }

  return (data ?? []).map((row) => mapDriverRow(row as DriverRow));
}

async function listSupabaseTransferRequests() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(transferRequestSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw formatSupabaseError("listar solicitudes", error);
  }

  return (data ?? []).map((row) => mapTransferRequestRow(row as TransferRequestRow));
}

function mapGeneratedMessageForInsert(message: GeneratedWhatsappMessage) {
  return {
    transfer_request_id: message.transferRequestId,
    channel: message.channel,
    template: message.template,
    recipient_name: message.recipientName ?? null,
    recipient_phone: message.recipientPhone ?? null,
    body: message.body,
    status: message.status,
    metadata: message.metadata ?? {}
  };
}

function getAssignmentMessageAudience(message: RequestMessage) {
  return typeof message.metadata?.audience === "string" ? message.metadata.audience : null;
}

function mergeMessages(existingMessages: RequestMessage[], nextMessages: RequestMessage[]) {
  const byId = new Map<string, RequestMessage>();

  for (const message of [...nextMessages, ...existingMessages]) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listSupabaseRequestMessages() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("request_messages")
    .select(requestMessageSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw formatSupabaseError("listar mensajes generados", error);
  }

  return (data ?? []).map((row) => mapRequestMessageRow(row as RequestMessageRow));
}

async function listSupabaseRequestMessagesByRequest(requestId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("request_messages")
    .select(requestMessageSelect)
    .eq("transfer_request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    throw formatSupabaseError("listar mensajes generados de la solicitud", error);
  }

  return (data ?? []).map((row) => mapRequestMessageRow(row as RequestMessageRow));
}

async function listSupabaseCommunicationEvents() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("communication_events")
    .select(communicationEventSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw formatSupabaseError("listar historial de comunicaciones", error);
  }

  return (data ?? []).map((row) => mapCommunicationEventRow(row as CommunicationEventRow));
}

function mapCommunicationEventForInsert(input: CreateCommunicationEventInput) {
  return {
    transfer_request_id: input.transferRequestId,
    type: input.type,
    channel: input.channel,
    recipient_type: input.recipientType,
    recipient_name: input.recipientName ?? null,
    recipient_phone: input.recipientPhone ?? null,
    message_body: input.messageBody ?? null,
    created_by: input.createdBy ?? null
  };
}

async function saveSupabaseAssignmentMessages(
  request: TransferRequest,
  driver: Driver
): Promise<RequestMessage[]> {
  const existingMessages = await listSupabaseRequestMessagesByRequest(request.id);
  const existingAssignmentMessages = existingMessages.filter(
    (message) => message.template === "driver_assignment"
  );
  const existingAudiences = new Set(existingAssignmentMessages.map(getAssignmentMessageAudience));
  const generatedMessages = prepareAssignmentWhatsappMessages(request, driver);
  const missingMessages = generatedMessages.filter(
    (message) =>
      !existingAudiences.has(
        typeof message.metadata?.audience === "string" ? message.metadata.audience : null
      )
  );

  if (missingMessages.length === 0) {
    return existingAssignmentMessages;
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("request_messages")
    .insert(missingMessages.map(mapGeneratedMessageForInsert))
    .select(requestMessageSelect);

  if (error) {
    throw formatSupabaseError("guardar mensajes generados", error);
  }

  const savedMessages = (data ?? []).map((row) => mapRequestMessageRow(row as RequestMessageRow));
  return mergeMessages(existingAssignmentMessages, savedMessages);
}

export function createSupabaseRepositories(): LogisticsRepositories {
  const localRepositories = createLocalRepositories();

  return {
    ...localRepositories,
    provider: "supabase",
    async refreshSnapshot(snapshot) {
      const [drivers, requests, messages, communicationEvents] = await Promise.all([
        listSupabaseDrivers(),
        listSupabaseTransferRequests(),
        listSupabaseRequestMessages(),
        listSupabaseCommunicationEvents()
      ]);
      return {
        ...snapshot,
        requests,
        drivers,
        messages,
        communicationEvents
      };
    },
    transferRequests: {
      async create(snapshot, input) {
        const supabase = createSupabaseBrowserClient();
        const draft = buildTransferRequestDraft(input);
        const { completeness, ...payload } = draft;
        const { data, error } = await supabase
          .from("transfer_requests")
          .insert(mapTransferRequestForWrite(payload))
          .select(transferRequestSelect)
          .single();

        if (error) {
          throw formatSupabaseError("crear solicitud", error);
        }

        const request = mapTransferRequestRow(data as TransferRequestRow);

        return {
          snapshot: {
            ...snapshot,
            requests: [request, ...snapshot.requests]
          },
          request
        };
      },
      async update(snapshot, requestId, input) {
        const existing = snapshot.requests.find((request) => request.id === requestId);

        if (!existing) {
          throw new Error("No encontramos esta solicitud para actualizar.");
        }

        const normalized = normalizeTransferRequestInput(input);
        const updated = refreshTransferRequestStatus({
          ...existing,
          ...normalized,
          updatedAt: new Date().toISOString()
        });
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("transfer_requests")
          .update(mapTransferRequestForUpdate(updated))
          .eq("id", requestId)
          .select(transferRequestSelect)
          .single();

        if (error) {
          throw formatSupabaseError("actualizar solicitud", error);
        }

        const request = mapTransferRequestRow(data as TransferRequestRow);

        return {
          ...snapshot,
          requests: snapshot.requests.map((item) => (item.id === requestId ? request : item))
        };
      },
      async markReady(snapshot, requestId) {
        const existing = snapshot.requests.find((request) => request.id === requestId);

        if (!existing) {
          throw new Error("No encontramos esta solicitud para marcarla lista.");
        }

        const readyRequest = markTransferRequestReadyToAssign(existing);
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("transfer_requests")
          .update({ status: readyRequest.status })
          .eq("id", requestId)
          .select(transferRequestSelect)
          .single();

        if (error) {
          throw formatSupabaseError("marcar solicitud lista para asignar", error);
        }

        const request = mapTransferRequestRow(data as TransferRequestRow);

        return {
          ...snapshot,
          requests: snapshot.requests.map((item) => (item.id === requestId ? request : item))
        };
      },
      async assignDriver(snapshot, requestId, driverId) {
        const request = snapshot.requests.find((item) => item.id === requestId);
        const driver = snapshot.drivers.find((item) => item.id === driverId);

        if (!request) {
          throw new Error("No encontramos esta solicitud para asignar conductor.");
        }

        if (!driver) {
          throw new Error("No encontramos este conductor para asignarlo.");
        }

        const assignedRequest = {
          ...assignDriverToTransferRequest(request, driver),
          updatedAt: new Date().toISOString()
        };
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("transfer_requests")
          .update({
            assigned_driver_id: assignedRequest.assignedDriverId,
            status: assignedRequest.status
          })
          .eq("id", requestId)
          .select(transferRequestSelect)
          .single();

        if (error) {
          throw formatSupabaseError("asignar conductor", error);
        }

        const savedRequest = mapTransferRequestRow(data as TransferRequestRow);
        const generatedMessages = await saveSupabaseAssignmentMessages(savedRequest, driver);

        return {
          snapshot: {
            ...snapshot,
            requests: snapshot.requests.map((item) =>
              item.id === requestId ? savedRequest : item
            ),
            messages: mergeMessages(snapshot.messages, generatedMessages)
          },
          request: savedRequest,
          messages: generatedMessages
        };
      }
    },
    drivers: {
      async create(snapshot, input) {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("drivers")
          .insert(mapDriverInput(input))
          .select(
            driverSelect
          )
          .single();

        if (error) {
          throw formatSupabaseError("crear conductor", error);
        }

        return {
          ...snapshot,
          drivers: [mapDriverRow(data as DriverRow), ...snapshot.drivers]
        };
      },
      async update(snapshot, driverId, input) {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("drivers")
          .update(mapDriverInput(input))
          .eq("id", driverId)
          .select(
            driverSelect
          )
          .single();

        if (error) {
          throw formatSupabaseError("editar conductor", error);
        }

        const updatedDriver = mapDriverRow(data as DriverRow);
        return {
          ...snapshot,
          drivers: snapshot.drivers.map((driver) =>
            driver.id === driverId ? updatedDriver : driver
          )
        };
      },
      async setActive(snapshot, driverId, isActive) {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("drivers")
          .update({ availability: isActive ? "available" : "inactive" })
          .eq("id", driverId)
          .select(
            driverSelect
          )
          .single();

        if (error) {
          throw formatSupabaseError(
            isActive ? "activar conductor" : "desactivar conductor",
            error
          );
        }

        const updatedDriver = mapDriverRow(data as DriverRow);
        return {
          ...snapshot,
          drivers: snapshot.drivers.map((driver) =>
            driver.id === driverId ? updatedDriver : driver
          )
        };
      },
      async delete(snapshot, driverId) {
        const supabase = createSupabaseBrowserClient();
        const { data: assignedRequests, error: assignedError } = await supabase
          .from("transfer_requests")
          .select("id")
          .eq("assigned_driver_id", driverId)
          .limit(1);

        if (assignedError) {
          throw formatSupabaseError("validar asignaciones del conductor", assignedError);
        }

        if ((assignedRequests ?? []).length > 0) {
          throw new Error(
            "Este conductor está asignado a una solicitud. Desactívalo en lugar de eliminarlo."
          );
        }

        const { error } = await supabase.from("drivers").delete().eq("id", driverId);

        if (error) {
          throw formatSupabaseError("eliminar conductor", error);
        }

        return {
          ...snapshot,
          drivers: snapshot.drivers.filter((driver) => driver.id !== driverId)
        };
      }
    },
    messages: {
      list(snapshot) {
        return [...snapshot.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      listByRequest(snapshot, requestId) {
        return snapshot.messages.filter((message) => message.transferRequestId === requestId);
      },
      latest(snapshot: LogisticsSnapshot, limit = 5) {
        return [...snapshot.messages]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit);
      },
      async updateStatus(snapshot, messageId, status) {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("request_messages")
          .update({ status })
          .eq("id", messageId)
          .select(requestMessageSelect)
          .single();

        if (error && status === "copied") {
          const currentMessage = snapshot.messages.find((message) => message.id === messageId);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("request_messages")
            .update({
              metadata: {
                ...(currentMessage?.metadata ?? {}),
                manual_status: "copied"
              }
            })
            .eq("id", messageId)
            .select(requestMessageSelect)
            .single();

          if (fallbackError) {
            throw formatSupabaseError("actualizar estado del mensaje", fallbackError);
          }

          const fallbackMessage = mapRequestMessageRow(fallbackData as RequestMessageRow);

          return {
            ...snapshot,
            messages: snapshot.messages.map((message) =>
              message.id === messageId ? fallbackMessage : message
            )
          };
        }

        if (error) {
          throw formatSupabaseError("actualizar estado del mensaje", error);
        }

        const updatedMessage = mapRequestMessageRow(data as RequestMessageRow);

        return {
          ...snapshot,
          messages: snapshot.messages.map((message) =>
            message.id === messageId ? updatedMessage : message
          )
        };
      }
    },
    communicationEvents: {
      listByRequest(snapshot, requestId) {
        return snapshot.communicationEvents
          .filter((event) => event.transferRequestId === requestId)
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
      },
      async create(snapshot, input) {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("communication_events")
          .insert(mapCommunicationEventForInsert(input))
          .select(communicationEventSelect)
          .single();

        if (error) {
          throw formatSupabaseError("registrar comunicación", error);
        }

        const event = mapCommunicationEventRow(data as CommunicationEventRow);

        return {
          ...snapshot,
          communicationEvents: [event, ...snapshot.communicationEvents]
        };
      }
    },
    aiConversations: {
      async list() {
        return notImplemented("aiConversations.list");
      },
      async save() {
        return notImplemented("aiConversations.save");
      }
    },
    dashboard: {
      getOverview(snapshot) {
        return buildDashboardOverview({
          requests: snapshot.requests,
          drivers: snapshot.drivers,
          messages: snapshot.messages
        });
      }
    }
  };
}
