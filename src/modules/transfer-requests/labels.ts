import type { TransferRequest } from "@/types";

export const TRANSFER_REQUEST_FIELD_LABELS: Partial<Record<keyof TransferRequest, string>> = {
  companyName: "Empresa",
  requesterName: "Solicitante",
  requesterPhone: "Teléfono solicitante",
  passengerName: "Pasajero",
  passengerPhone: "Teléfono pasajero",
  passengerCount: "Cantidad de pasajeros",
  pickupDate: "Fecha",
  pickupTime: "Hora",
  originAddress: "Origen",
  destinationAddress: "Destino"
};

export function getTransferRequestDisplaySummary(request: Partial<TransferRequest>) {
  return {
    company: request.companyName ?? "Empresa pendiente",
    passenger: request.passengerName ?? "Pasajero pendiente",
    origin: request.originAddress ?? "Origen pendiente",
    destination: request.destinationAddress ?? "Destino pendiente",
    date: request.pickupDate ?? "Fecha pendiente",
    time: request.pickupTime ?? "Hora pendiente"
  };
}

export function getTransferRequestPrimaryActionLabel(request: Partial<TransferRequest>) {
  return request.status === "incomplete" ? "Guardar avances" : "Guardar cambios";
}

export function getTransferRequestReviewText(request: Partial<TransferRequest>) {
  return request.status === "pending_review" ? "Lista para revisión" : null;
}
