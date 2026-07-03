import {
  formatDisplayName,
  formatPersonName,
  normalizeChileanPhone,
  normalizeVehiclePlate
} from "@/lib/formatters/operational-data";
import type { CreateDriverInput, Driver } from "@/types";

export function buildDriverProfile(input: CreateDriverInput) {
  return {
    ...input,
    fullName: formatPersonName(input.fullName),
    phone: normalizeChileanPhone(input.phone),
    vehicleName: input.vehicleName ? formatDisplayName(input.vehicleName) : null,
    vehiclePlate: normalizeVehiclePlate(input.vehiclePlate),
    vehicleCapacity: input.vehicleCapacity ?? null,
    isSeed: false,
    availability: input.availability ?? "available"
  };
}

export function isDriverAssignable(input: Pick<CreateDriverInput, "availability">) {
  return (input.availability ?? "available") === "available";
}

export function updateDriverProfile(driver: Driver, input: CreateDriverInput): Driver {
  return {
    ...driver,
    ...buildDriverProfile(input),
    isSeed: driver.isSeed ?? false,
    updatedAt: new Date().toISOString()
  };
}

export function setDriverActiveState(driver: Driver, isActive: boolean): Driver {
  return {
    ...driver,
    availability: isActive ? "available" : "inactive",
    updatedAt: new Date().toISOString()
  };
}
