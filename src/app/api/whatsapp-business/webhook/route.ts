import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { WhatsAppBusinessProvider } from "@/modules/whatsapp/providers/whatsapp-business";

const signatureHeaderName = "x-hub-signature-256";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken && verifyToken === process.env.WHATSAPP_BUSINESS_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureValidation = validateMetaSignature(request, rawBody);

  if (!signatureValidation.ok) {
    return NextResponse.json({ error: signatureValidation.error }, { status: signatureValidation.status });
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WhatsAppBusinessProvider.parseInboundWebhook(body);

  console.info("whatsapp_business.webhook.received", {
    inboundMessages: parsed.inboundMessages.length,
    inboundKinds: countByKind(parsed.inboundMessages.map((message) => message.kind)),
    statusCallbacks: parsed.statusCallbacks.length,
    statusKinds: countByKind(parsed.statusCallbacks.map((status) => status.status ?? "unknown")),
    ignoredEvents: parsed.ignoredEvents
  });

  return NextResponse.json({
    ok: true,
    provider: parsed.provider,
    inboundMessages: parsed.inboundMessages.length,
    statusCallbacks: parsed.statusCallbacks.length,
    ignoredEvents: parsed.ignoredEvents
  });
}

function validateMetaSignature(request: Request, rawBody: string) {
  if (!isSignatureRequired()) {
    return { ok: true as const };
  }

  const appSecret = process.env.WHATSAPP_BUSINESS_APP_SECRET;

  if (!appSecret) {
    return {
      ok: false as const,
      status: 500,
      error: "WhatsApp Business webhook signature validation is required but app secret is missing"
    };
  }

  const signature = request.headers.get(signatureHeaderName);

  if (!signature) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing WhatsApp Business webhook signature"
    };
  }

  if (!isValidMetaSignature(rawBody, signature, appSecret)) {
    return {
      ok: false as const,
      status: 403,
      error: "Invalid WhatsApp Business webhook signature"
    };
  }

  return { ok: true as const };
}

function isSignatureRequired() {
  return process.env.WHATSAPP_WEBHOOK_SIGNATURE_REQUIRED === "true";
}

function isValidMetaSignature(rawBody: string, signature: string, appSecret: string) {
  const [algorithm, receivedHash] = signature.split("=");

  if (algorithm !== "sha256" || !receivedHash) {
    return false;
  }

  const expectedHash = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const receivedBuffer = Buffer.from(receivedHash, "hex");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function countByKind(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
