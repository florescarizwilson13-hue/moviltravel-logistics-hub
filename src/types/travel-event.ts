export type TravelEventType =
  | "driver_at_pickup"
  | "passenger_on_board"
  | "completed"
  | "incident"
  | "manual_correction";

export type TravelEvent = {
  id: string;
  transferRequestId: string;
  type: TravelEventType;
  source: "whatsapp_driver" | "manual";
  actorType: "driver" | "coordinator";
  actorName?: string | null;
  actorPhone?: string | null;
  messageBody?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  locationLabel?: string | null;
  createdAt: string;
};

export type CreateTravelEventInput = Omit<TravelEvent, "id" | "createdAt">;
