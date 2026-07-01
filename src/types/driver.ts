export type DriverAvailability = "available" | "busy" | "inactive";

export type Driver = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  vehicleName?: string | null;
  vehiclePlate?: string | null;
  vehicleCapacity?: number | null;
  availability: DriverAvailability;
  isSeed?: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDriverInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  vehicleName?: string | null;
  vehiclePlate?: string | null;
  vehicleCapacity?: number | null;
  availability?: DriverAvailability;
  notes?: string | null;
};
