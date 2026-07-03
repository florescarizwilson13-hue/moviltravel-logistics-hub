import type {
  WhatsAppInboundMessage,
  WhatsAppMessageKind,
  WhatsAppMessageLocation
} from "./types";

type TwilioSandboxPayload = Record<string, string | undefined>;

export const TwilioSandboxProvider = {
  name: "twilio_sandbox" as const,

  async parseInboundRequest(request: Request): Promise<WhatsAppInboundMessage> {
    const payload = await readTwilioPayload(request);
    const location = parseTwilioLocation(payload);

    return {
      provider: "twilio_sandbox",
      kind: getTwilioMessageKind(payload, location),
      from: payload.From ?? null,
      to: payload.To ?? null,
      body: payload.Body?.trim() ?? "",
      profileName: payload.ProfileName ?? null,
      providerMessageId: payload.MessageSid ?? payload.SmsMessageSid ?? null,
      location,
      rawPayload: payload
    };
  },

  buildMessagingResponseXml(message: string) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
      message
    )}</Message></Response>`;
  }
};

async function readTwilioPayload(request: Request): Promise<TwilioSandboxPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return normalizeJsonPayload(await request.json());
  }

  const formData = await request.formData();
  const payload: TwilioSandboxPayload = {};

  formData.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : undefined;
  });

  return payload;
}

function normalizeJsonPayload(value: unknown): TwilioSandboxPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : entry == null ? undefined : String(entry)
    ])
  );
}

function getTwilioMessageKind(
  payload: TwilioSandboxPayload,
  location: WhatsAppMessageLocation | null
): WhatsAppMessageKind {
  if (location) {
    return "location";
  }

  if (payload.Body?.trim()) {
    return "text";
  }

  return "unknown";
}

function parseTwilioLocation(payload: TwilioSandboxPayload): WhatsAppMessageLocation | null {
  const latitude = parseNumber(payload.Latitude ?? payload.Lat);
  const longitude = parseNumber(payload.Longitude ?? payload.Lng ?? payload.Long);

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: parseNumber(payload.LocationAccuracy ?? payload.Accuracy),
    label: payload.Label ?? payload.Address ?? null
  };
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
