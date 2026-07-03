export type WhatsAppProviderName = "twilio_sandbox" | "whatsapp_business";

export type WhatsAppMessageKind = "text" | "location" | "unknown";

export type WhatsAppMessageLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  label?: string | null;
};

export type WhatsAppInboundMessage = {
  provider: WhatsAppProviderName;
  kind: WhatsAppMessageKind;
  from?: string | null;
  to?: string | null;
  body: string;
  profileName?: string | null;
  providerMessageId?: string | null;
  location?: WhatsAppMessageLocation | null;
  rawPayload?: Record<string, unknown>;
};

export type WhatsAppOutboundMessage = {
  to?: string | null;
  body: string;
  kind?: WhatsAppMessageKind;
};
