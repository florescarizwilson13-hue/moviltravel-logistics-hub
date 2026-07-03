import { createTransferRequestSchema } from "@/lib/validators/transfer-request";
import type { CreateTransferRequestInput, Driver, TransferRequest } from "@/types";
import { getTransferRequestCompleteness } from "./completeness";
import { resolveInitialTransferRequestStatus } from "./status";

export function buildTransferRequestDraft(input: CreateTransferRequestInput) {
  const normalized = normalizeTransferRequestInput(input);
  const parsed = createTransferRequestSchema.parse(normalized);
  const status = resolveInitialTransferRequestStatus(parsed);

  return {
    ...parsed,
    status,
    completeness: getTransferRequestCompleteness(parsed)
  };
}

export function canAssignTransferRequest(request: TransferRequest) {
  const completeness = getTransferRequestCompleteness(request);
  return completeness.isComplete && ["ready_to_assign", "assigned"].includes(request.status);
}

export function normalizeTransferRequestInput(
  input: CreateTransferRequestInput
): CreateTransferRequestInput {
  const pickupAt =
    input.pickupAt ??
    (input.pickupDate && input.pickupTime ? `${input.pickupDate}T${input.pickupTime}:00` : null);

  return {
    ...input,
    companyName: normalizeText(input.companyName),
    requesterName: normalizeText(input.requesterName),
    requesterPhone: normalizeText(input.requesterPhone),
    requesterEmail: normalizeText(input.requesterEmail),
    passengerName: normalizeText(input.passengerName),
    passengerPhone: normalizeText(input.passengerPhone),
    originAddress: normalizeText(input.originAddress),
    destinationAddress: normalizeText(input.destinationAddress),
    pickupDate: normalizeText(input.pickupDate),
    pickupTime: normalizeText(input.pickupTime),
    pickupAt,
    cargoDescription: normalizeText(input.cargoDescription),
    specialRequirements: normalizeText(input.specialRequirements),
    notes: normalizeText(input.notes)
  };
}

export function refreshTransferRequestStatus(request: TransferRequest): TransferRequest {
  if (
    [
      "ready_to_assign",
      "assigned",
      "driver_at_pickup",
      "passenger_on_board",
      "confirmed",
      "in_progress",
      "completed",
      "incident",
      "cancelled"
    ].includes(request.status)
  ) {
    return request;
  }

  return {
    ...request,
    status: getTransferRequestCompleteness(request).isComplete ? "pending_review" : "incomplete"
  };
}

export function markTransferRequestReadyToAssign(request: TransferRequest): TransferRequest {
  if (!getTransferRequestCompleteness(request).isComplete) {
    throw new Error("Cannot mark request as ready to assign while required fields are missing.");
  }

  return {
    ...request,
    status: "ready_to_assign"
  };
}

export function assignDriverToTransferRequest(
  request: TransferRequest,
  driver: Pick<Driver, "id">
): TransferRequest {
  if (!canAssignTransferRequest({ ...request, status: "ready_to_assign" })) {
    throw new Error("Cannot assign driver until the request is complete.");
  }

  return {
    ...request,
    assignedDriverId: driver.id,
    status: "assigned"
  };
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
