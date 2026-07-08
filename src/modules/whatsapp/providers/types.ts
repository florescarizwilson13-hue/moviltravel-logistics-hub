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

export type WhatsAppBusinessTemplateMessage = {
  to: string;
  templateName: string;
  languageCode: string;
  variables?: Record<string, string | number | null | undefined>;
};

export type WhatsAppBusinessInteractiveButton = {
  id: string;
  title: string;
};

export type WhatsAppBusinessInteractiveButtonsPayload = {
  to: string;
  body: string;
  buttons: WhatsAppBusinessInteractiveButton[];
  headerText?: string | null;
  footerText?: string | null;
};

export type WhatsAppBusinessInteractiveListRow = {
  id: string;
  title: string;
  description?: string | null;
};

export type WhatsAppBusinessInteractiveListSection = {
  title?: string | null;
  rows: WhatsAppBusinessInteractiveListRow[];
};

export type WhatsAppBusinessInteractiveList = {
  to: string;
  body: string;
  buttonText: string;
  sections: WhatsAppBusinessInteractiveListSection[];
  headerText?: string | null;
  footerText?: string | null;
};

export type WhatsAppBusinessLocationPayload = {
  to: string;
  body: string;
};

export type WhatsAppBusinessInboundMessage = {
  kind: WhatsAppMessageKind;
  from?: string | null;
  to?: string | null;
  body: string;
  profileName?: string | null;
  providerMessageId?: string | null;
  location?: WhatsAppMessageLocation | null;
  rawPayload?: Record<string, unknown>;
};

export type WhatsAppBusinessStatusCallback = {
  providerMessageId?: string | null;
  recipientId?: string | null;
  status?: string | null;
  timestamp?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type WhatsAppBusinessWebhookParseResult = {
  provider: "whatsapp_business";
  inboundMessages: WhatsAppBusinessInboundMessage[];
  statusCallbacks: WhatsAppBusinessStatusCallback[];
  ignoredEvents: number;
};
