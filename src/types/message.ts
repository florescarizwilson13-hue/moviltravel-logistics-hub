export type MessageChannel = "whatsapp";
export type MessageStatus = "draft" | "generated" | "copied" | "queued" | "sent" | "failed";
export type MessageTemplate = "request_summary" | "driver_assignment" | "missing_information";

export type RequestMessage = {
  id: string;
  transferRequestId: string;
  channel: MessageChannel;
  template: MessageTemplate;
  recipientName?: string | null;
  recipientPhone?: string | null;
  body: string;
  status: MessageStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedWhatsappMessage = Omit<RequestMessage, "id" | "createdAt" | "updatedAt">;
