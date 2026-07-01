import { z } from "zod";
import { TRANSFER_REQUEST_STATUSES } from "@/lib/constants/statuses";

export const createTransferRequestSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  companyName: z.string().nullable().optional(),
  requesterName: z.string().min(1).nullable().optional(),
  requesterPhone: z.string().min(6).nullable().optional(),
  requesterEmail: z.string().email().nullable().optional(),
  passengerName: z.string().min(1).nullable().optional(),
  passengerPhone: z.string().min(6).nullable().optional(),
  originAddress: z.string().min(1).nullable().optional(),
  destinationAddress: z.string().min(1).nullable().optional(),
  pickupDate: z.string().nullable().optional(),
  pickupTime: z.string().nullable().optional(),
  pickupAt: z.string().nullable().optional(),
  passengerCount: z.number().int().positive().nullable().optional(),
  cargoDescription: z.string().nullable().optional(),
  specialRequirements: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assignedDriverId: z.string().uuid().nullable().optional(),
  assignedVehicleId: z.string().uuid().nullable().optional(),
  status: z.enum(TRANSFER_REQUEST_STATUSES).optional()
});

export const requiredTransferRequestFields = [
  "companyName",
  "requesterName",
  "requesterPhone",
  "passengerName",
  "passengerPhone",
  "passengerCount",
  "originAddress",
  "destinationAddress",
  "pickupDate",
  "pickupTime"
] as const;
