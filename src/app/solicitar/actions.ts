"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildTransferRequestDraft } from "@/modules/transfer-requests";
import type { CreateTransferRequestInput } from "@/types";

export type PublicRequestActionState = {
  ok: boolean;
  message: string;
};

export async function createPublicTransferRequest(
  input: CreateTransferRequestInput
): Promise<PublicRequestActionState> {
  try {
    const supabase = await createPublicWriteClient();
    const request = buildTransferRequestDraft({
      ...input,
      notes: withSourceNote(input.notes, "Formulario público")
    });
    const { error } = await supabase.from("transfer_requests").insert({
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
      status: request.status
    });

    if (error) {
      return {
        ok: false,
        message: "No pudimos recibir la solicitud. Intenta nuevamente o contacta al equipo."
      };
    }

    return {
      ok: true,
      message: "Solicitud recibida. El equipo coordinará el traslado."
    };
  } catch {
    return {
      ok: false,
      message: "No pudimos recibir la solicitud. Intenta nuevamente o contacta al equipo."
    };
  }
}

async function createPublicWriteClient() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return createSupabaseServerClient();
  }
}

function withSourceNote(notes: string | null | undefined, source: string) {
  const cleanNotes = notes?.trim();
  return cleanNotes ? `Origen solicitud: ${source}\n${cleanNotes}` : `Origen solicitud: ${source}`;
}
