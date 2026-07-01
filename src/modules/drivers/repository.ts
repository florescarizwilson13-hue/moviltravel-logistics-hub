import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateDriverInput } from "@/types";
import { buildDriverProfile } from "./service";

export async function createDriver(supabase: SupabaseClient, input: CreateDriverInput) {
  const driver = buildDriverProfile(input);

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      full_name: driver.fullName,
      phone: driver.phone,
      email: driver.email,
      license_number: driver.licenseNumber,
      vehicle_name: driver.vehicleName,
      vehicle_plate: driver.vehiclePlate,
      vehicle_capacity: driver.vehicleCapacity,
      availability: driver.availability,
      is_seed: driver.isSeed,
      notes: driver.notes
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
