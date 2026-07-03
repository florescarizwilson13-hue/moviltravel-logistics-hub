"use client";

import { MOCK_DRIVERS, MOCK_TRANSFER_REQUESTS } from "@/lib/local/mock-data";
import {
  buildDriverProfile,
  setDriverActiveState,
  updateDriverProfile
} from "@/modules/drivers";
import { prepareAssignmentWhatsappMessages } from "@/modules/messaging";
import {
  assignDriverToTransferRequest,
  buildTransferRequestDraft,
  markTransferRequestReadyToAssign,
  normalizeTransferRequestInput,
  refreshTransferRequestStatus
} from "@/modules/transfer-requests";
import type {
  CreateTransferRequestInput,
  CreateDriverInput,
  Driver,
  GeneratedWhatsappMessage,
  CommunicationEvent,
  RequestMessage,
  TransferRequest
} from "@/types";

const STORAGE_KEY = "moviltravel-logistics-hub:local-store:v2";

export type LocalLogisticsStore = {
  requests: TransferRequest[];
  drivers: Driver[];
  messages: RequestMessage[];
  communicationEvents: CommunicationEvent[];
};

export function loadLocalLogisticsStore(): LocalLogisticsStore {
  if (typeof window === "undefined") {
    return createInitialStore();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initial = createInitialStore();
    saveLocalLogisticsStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(stored) as LocalLogisticsStore;
    const normalized = normalizeLocalLogisticsStore(parsed);
    saveLocalLogisticsStore(normalized);
    return normalized;
  } catch {
    const initial = createInitialStore();
    saveLocalLogisticsStore(initial);
    return initial;
  }
}

export function saveLocalLogisticsStore(store: LocalLogisticsStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Si el navegador bloquea localStorage, la app debe seguir operando con el estado en memoria.
  }
}

export function createLocalTransferRequest(
  store: LocalLogisticsStore,
  input: CreateTransferRequestInput
) {
  const now = new Date().toISOString();
  const draft = buildTransferRequestDraft(input);
  const { completeness, ...payload } = draft;
  const request: TransferRequest = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: now,
    updatedAt: now
  };

  const nextStore = {
    ...store,
    requests: [request, ...store.requests]
  };

  return { store: nextStore, request, completeness };
}

export function updateLocalTransferRequest(
  store: LocalLogisticsStore,
  requestId: string,
  input: CreateTransferRequestInput
) {
  const existing = findRequestOrThrow(store, requestId);
  const normalized = normalizeTransferRequestInput(input);
  const updated = refreshTransferRequestStatus({
    ...existing,
    ...normalized,
    updatedAt: new Date().toISOString()
  });

  return {
    ...store,
    requests: store.requests.map((request) => (request.id === requestId ? updated : request))
  };
}

export function markLocalRequestReady(store: LocalLogisticsStore, requestId: string) {
  const existing = findRequestOrThrow(store, requestId);
  const updated = {
    ...markTransferRequestReadyToAssign(existing),
    updatedAt: new Date().toISOString()
  };

  return {
    ...store,
    requests: store.requests.map((request) => (request.id === requestId ? updated : request))
  };
}

export function assignLocalDriver(
  store: LocalLogisticsStore,
  requestId: string,
  driverId: string
) {
  const request = findRequestOrThrow(store, requestId);
  const driver = store.drivers.find((item) => item.id === driverId);

  if (!driver) {
    throw new Error("Driver not found.");
  }

  const assignedRequest = {
    ...assignDriverToTransferRequest(request, driver),
    updatedAt: new Date().toISOString()
  };
  const generatedMessages = prepareAssignmentWhatsappMessages(assignedRequest, driver).map(
    toStoredMessage
  );

  return {
    store: {
      ...store,
      requests: store.requests.map((item) => (item.id === requestId ? assignedRequest : item)),
      messages: [...generatedMessages, ...store.messages]
    },
    request: assignedRequest,
    messages: generatedMessages
  };
}

export function createLocalDriver(store: LocalLogisticsStore, input: CreateDriverInput) {
  const now = new Date().toISOString();
  const driver: Driver = {
    id: crypto.randomUUID(),
    ...buildDriverProfile(input),
    createdAt: now,
    updatedAt: now
  };

  return {
    ...store,
    drivers: [driver, ...store.drivers]
  };
}

export function updateLocalDriver(
  store: LocalLogisticsStore,
  driverId: string,
  input: CreateDriverInput
) {
  return {
    ...store,
    drivers: store.drivers.map((driver) =>
      driver.id === driverId ? updateDriverProfile(driver, input) : driver
    )
  };
}

export function setLocalDriverActiveState(
  store: LocalLogisticsStore,
  driverId: string,
  isActive: boolean
) {
  return {
    ...store,
    drivers: store.drivers.map((driver) =>
      driver.id === driverId ? setDriverActiveState(driver, isActive) : driver
    )
  };
}

export function deleteLocalDriver(store: LocalLogisticsStore, driverId: string) {
  const assignedRequest = store.requests.find(
    (request) => request.assignedDriverId === driverId
  );

  if (assignedRequest) {
    throw new Error(
      "Este conductor está asignado a una solicitud. Desactívalo en lugar de eliminarlo."
    );
  }

  return {
    ...store,
    drivers: store.drivers.filter((driver) => driver.id !== driverId)
  };
}

export function resetLocalLogisticsStore() {
  const initial = createInitialStore();
  saveLocalLogisticsStore(initial);
  return initial;
}

function createInitialStore(): LocalLogisticsStore {
  return {
    requests: MOCK_TRANSFER_REQUESTS,
    drivers: MOCK_DRIVERS,
    messages: [],
    communicationEvents: []
  };
}

function normalizeLocalLogisticsStore(store: LocalLogisticsStore): LocalLogisticsStore {
  const seedIds = new Set(MOCK_DRIVERS.map((driver) => driver.id));

  return {
    ...store,
    communicationEvents: store.communicationEvents ?? [],
    drivers: store.drivers.map((driver) => ({
      ...driver,
      availability: driver.availability === "busy" ? "inactive" : driver.availability,
      isSeed: driver.isSeed ?? seedIds.has(driver.id)
    }))
  };
}

function findRequestOrThrow(store: LocalLogisticsStore, requestId: string) {
  const request = store.requests.find((item) => item.id === requestId);

  if (!request) {
    throw new Error("Transfer request not found.");
  }

  return request;
}

function toStoredMessage(message: GeneratedWhatsappMessage): RequestMessage {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    ...message,
    createdAt: now,
    updatedAt: now
  };
}
