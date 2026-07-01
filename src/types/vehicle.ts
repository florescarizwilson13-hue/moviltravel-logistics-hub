export type VehicleStatus = "available" | "assigned" | "maintenance" | "inactive";

export type Vehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  capacity?: number | null;
  status: VehicleStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};
