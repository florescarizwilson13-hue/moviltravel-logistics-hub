export const TRANSFER_REQUEST_STATUSES = [
  "draft",
  "incomplete",
  "pending_review",
  "ready_to_assign",
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "confirmed",
  "in_progress",
  "completed",
  "incident",
  "cancelled"
] as const;

export const TRANSFER_REQUEST_STATUS_LABELS = {
  draft: "Borrador",
  incomplete: "Incompleta",
  pending_review: "Pendiente de revisión",
  ready_to_assign: "Lista para asignar",
  assigned: "Traslado asignado",
  driver_at_pickup: "En origen",
  passenger_on_board: "En traslado",
  confirmed: "Confirmada",
  in_progress: "En progreso",
  completed: "Finalizado",
  incident: "Incidencia",
  cancelled: "Cancelada"
} as const;

export const INITIAL_TRANSFER_REQUEST_STATUS = "draft";

export const ASSIGNABLE_TRANSFER_REQUEST_STATUSES = [
  "ready_to_assign",
  "assigned",
  "confirmed"
] as const;
