export type CommunicationChannel = "whatsapp";
export type CommunicationRecipientType = "passenger" | "driver";
export type CommunicationEventType =
  | "whatsapp_passenger_copied"
  | "whatsapp_driver_copied"
  | "whatsapp_passenger_marked_sent"
  | "whatsapp_driver_marked_sent";

export type CommunicationEvent = {
  id: string;
  transferRequestId: string;
  type: CommunicationEventType;
  channel: CommunicationChannel;
  recipientType: CommunicationRecipientType;
  recipientName?: string | null;
  recipientPhone?: string | null;
  messageBody?: string | null;
  createdBy?: string | null;
  createdAt: string;
};

export type CreateCommunicationEventInput = Omit<CommunicationEvent, "id" | "createdAt">;
