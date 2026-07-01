export const TRANSFER_REQUEST_STATUSES = [
  "draft",
  "incomplete",
  "pending_review",
  "ready_to_assign",
  "assigned",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
] as const;

export const TRANSFER_REQUEST_STATUS_LABELS = {
  draft: "Borrador",
  incomplete: "Incompleta",
  pending_review: "Pendiente de revisión",
  ready_to_assign: "Lista para asignar",
  assigned: "Traslado asignado",
  confirmed: "Confirmada",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada"
} as const;

export const INITIAL_TRANSFER_REQUEST_STATUS = "draft";

export const ASSIGNABLE_TRANSFER_REQUEST_STATUSES = [
  "ready_to_assign",
  "assigned",
  "confirmed"
] as const;
