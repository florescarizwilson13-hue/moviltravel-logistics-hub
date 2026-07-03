import { NextResponse } from "next/server";
import { TwilioSandboxProvider } from "@/modules/whatsapp/providers/twilio-sandbox";
import { processWhatsappInboundMessage } from "@/modules/whatsapp-inbound/service";

export async function POST(request: Request) {
  try {
    const message = await TwilioSandboxProvider.parseInboundRequest(request);
    const result = await processWhatsappInboundMessage(message);

    return twilioXmlResponse(result.reply);
  } catch {
    return twilioXmlResponse(
      "No pudimos registrar la solicitud por WhatsApp en este momento. Intenta nuevamente o contacta al equipo.",
      200
    );
  }
}

function twilioXmlResponse(message: string, status = 200) {
  return new NextResponse(TwilioSandboxProvider.buildMessagingResponseXml(message), {
    status,
    headers: {
      "content-type": "text/xml; charset=utf-8"
    }
  });
}
