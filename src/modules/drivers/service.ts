import type { CreateDriverInput, Driver } from "@/types";

export function buildDriverProfile(input: CreateDriverInput) {
  return {
    ...input,
    vehicleName: input.vehicleName ?? null,
    vehiclePlate: input.vehiclePlate ?? null,
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
