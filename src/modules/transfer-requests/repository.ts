import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTransferRequestInput } from "@/types";
import { buildTransferRequestDraft } from "./service";

export async function createTransferRequest(
  supabase: SupabaseClient,
  input: CreateTransferRequestInput
) {
  const draft = buildTransferRequestDraft(input);
  const { completeness, ...payload } = draft;

  const { data, error } = await supabase
    .from("transfer_requests")
    .insert({
      company_id: payload.companyId,
      company_name: payload.companyName,
      requester_name: payload.requesterName,
      requester_phone: payload.requesterPhone,
      requester_email: payload.requesterEmail,
      passenger_name: payload.passengerName,
      passenger_phone: payload.passengerPhone,
      origin_address: payload.originAddress,
      destination_address: payload.destinationAddress,
      pickup_date: payload.pickupDate,
      pickup_time: payload.pickupTime,
      pickup_at: payload.pickupAt,
      passenger_count: payload.passengerCount,
      cargo_description: payload.cargoDescription,
      special_requirements: payload.specialRequirements,
      notes: payload.notes,
      assigned_driver_id: payload.assignedDriverId,
      assigned_vehicle_id: payload.assignedVehicleId,
      status: payload.status
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { data, completeness };
}
