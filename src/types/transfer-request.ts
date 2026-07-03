import type { TransferRequestStatus } from "./status";

export type TransferRequest = {
  id: string;
  companyId?: string | null;
  companyName?: string | null;
  requesterName?: string | null;
  requesterPhone?: string | null;
  requesterEmail?: string | null;
  passengerName?: string | null;
  passengerPhone?: string | null;
  originAddress?: string | null;
  destinationAddress?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  pickupAt?: string | null;
  passengerCount?: number | null;
  cargoDescription?: string | null;
  specialRequirements?: string | null;
  notes?: string | null;
  assignedDriverId?: string | null;
  assignedVehicleId?: string | null;
  metadata?: Record<string, unknown> | null;
  status: TransferRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTransferRequestInput = Partial<
  Pick<
    TransferRequest,
    | "companyId"
    | "companyName"
    | "requesterName"
    | "requesterPhone"
    | "requesterEmail"
    | "passengerName"
    | "passengerPhone"
    | "originAddress"
    | "destinationAddress"
    | "pickupDate"
    | "pickupTime"
    | "pickupAt"
    | "passengerCount"
    | "cargoDescription"
    | "specialRequirements"
    | "notes"
    | "assignedDriverId"
    | "assignedVehicleId"
  >
> & {
  status?: TransferRequestStatus;
};

export type TransferRequestCompleteness = {
  isComplete: boolean;
  missingFields: Array<keyof TransferRequest>;
};

export type TransferRequestFormInput = CreateTransferRequestInput;
