import type { Driver, TransferRequest } from "@/types";

export const MOCK_DRIVERS: Driver[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Carolina Rojas",
    phone: "+56911111111",
    email: "carolina.rojas@example.com",
    licenseNumber: "A2-1020",
    vehicleName: "Mercedes-Benz Sprinter",
    vehiclePlate: "MT-1020",
    vehicleCapacity: 12,
    availability: "available",
    isSeed: true,
    notes: "Turno diurno",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Miguel Araya",
    phone: "+56922222222",
    email: "miguel.araya@example.com",
    licenseNumber: "A3-2040",
    vehicleName: "Hyundai H1",
    vehiclePlate: "MT-2040",
    vehicleCapacity: 8,
    availability: "available",
    isSeed: true,
    notes: "Disponible para aeropuerto",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Paula Medina",
    phone: "+56933333333",
    email: "paula.medina@example.com",
    licenseNumber: "A2-3090",
    vehicleName: "Peugeot Expert",
    vehiclePlate: "MT-3090",
    vehicleCapacity: 7,
    availability: "inactive",
    isSeed: true,
    notes: "No asignar salvo excepcion",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MOCK_TRANSFER_REQUESTS: TransferRequest[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyName: "Minera Norte",
    requesterName: "Daniela Soto",
    requesterPhone: "+56998765432",
    passengerName: "Carlos Vega",
    passengerPhone: null,
    passengerCount: 2,
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupTime: "09:30",
    pickupAt: `${new Date().toISOString().slice(0, 10)}T09:30:00`,
    originAddress: "Hotel Plaza, Santiago",
    destinationAddress: "Aeropuerto SCL",
    notes: "Pasajero con equipaje grande",
    status: "incomplete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
