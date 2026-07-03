import { NextResponse } from "next/server";
import {
  processWhatsappInboundMessage,
  type TwilioWhatsappInboundPayload
} from "@/modules/whatsapp-inbound/service";

export async function POST(request: Request) {
  try {
    const payload = await readTwilioPayload(request);
    const result = await processWhatsappInboundMessage(payload);

    return twilioXmlResponse(result.reply);
  } catch {
    return twilioXmlResponse(
      "No pudimos registrar la solicitud por WhatsApp en este momento. Intenta nuevamente o contacta al equipo.",
      200
    );
  }
}

async function readTwilioPayload(request: Request): Promise<TwilioWhatsappInboundPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as TwilioWhatsappInboundPayload;
  }

  const formData = await request.formData();

  return {
    From: getFormValue(formData, "From"),
    To: getFormValue(formData, "To"),
    Body: getFormValue(formData, "Body"),
    ProfileName: getFormValue(formData, "ProfileName"),
    MessageSid: getFormValue(formData, "MessageSid"),
    SmsMessageSid: getFormValue(formData, "SmsMessageSid")
  };
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function twilioXmlResponse(message: string, status = 200) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
      message
    )}</Message></Response>`,
    {
      status,
      headers: {
        "content-type": "text/xml; charset=utf-8"
      }
    }
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
