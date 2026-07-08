import type {
  WhatsAppBusinessInboundMessage,
  WhatsAppBusinessInteractiveButtonsPayload,
  WhatsAppBusinessInteractiveList,
  WhatsAppBusinessLocationPayload,
  WhatsAppBusinessStatusCallback,
  WhatsAppBusinessTemplateMessage,
  WhatsAppBusinessWebhookParseResult,
  WhatsAppMessageLocation
} from "./types";

export const WhatsAppBusinessProvider = {
  name: "whatsapp_business" as const,

  parseInboundWebhook(input: unknown): WhatsAppBusinessWebhookParseResult {
    const entries = getObjectArray(readObject(input)?.entry);
    const inboundMessages: WhatsAppBusinessInboundMessage[] = [];
    const statusCallbacks: WhatsAppBusinessStatusCallback[] = [];
    let ignoredEvents = 0;

    for (const entry of entries) {
      const changes = getObjectArray(entry.change ?? entry.changes);

      for (const change of changes) {
        const value = readObject(change.value);

        if (!value) {
          ignoredEvents += 1;
          continue;
        }

        const metadata = readObject(value.metadata);
        const contacts = getObjectArray(value.contacts);

        for (const message of getObjectArray(value.messages)) {
          const parsedMessage = parseMetaMessage(message, metadata, contacts);

          if (parsedMessage) {
            inboundMessages.push(parsedMessage);
          } else {
            ignoredEvents += 1;
          }
        }

        for (const status of getObjectArray(value.statuses)) {
          statusCallbacks.push(parseMetaStatus(status));
        }
      }
    }

    return {
      provider: "whatsapp_business",
      inboundMessages,
      statusCallbacks,
      ignoredEvents
    };
  },

  buildOutboundTemplatePayload(input: WhatsAppBusinessTemplateMessage) {
    return {
      provider: "whatsapp_business" as const,
      type: "template" as const,
      to: input.to,
      template: {
        name: input.templateName,
        languageCode: input.languageCode,
        variables: input.variables ?? {}
      }
    };
  },

  buildInteractiveButtonsPayload(input: WhatsAppBusinessInteractiveButtonsPayload) {
    return {
      provider: "whatsapp_business" as const,
      type: "interactive_buttons" as const,
      to: input.to,
      headerText: input.headerText ?? null,
      body: input.body,
      footerText: input.footerText ?? null,
      buttons: input.buttons
    };
  },

  buildInteractiveListPayload(input: WhatsAppBusinessInteractiveList) {
    return {
      provider: "whatsapp_business" as const,
      type: "interactive_list" as const,
      to: input.to,
      headerText: input.headerText ?? null,
      body: input.body,
      footerText: input.footerText ?? null,
      buttonText: input.buttonText,
      sections: input.sections
    };
  },

  buildLocationRequestPayload(input: WhatsAppBusinessLocationPayload) {
    return {
      provider: "whatsapp_business" as const,
      type: "location_request" as const,
      to: input.to,
      body: input.body
    };
  }
};

function parseMetaMessage(
  message: Record<string, unknown>,
  metadata: Record<string, unknown> | null,
  contacts: Array<Record<string, unknown>>
): WhatsAppBusinessInboundMessage | null {
  const messageType = getString(message.type);
  const from = getString(message.from);
  const to = getString(metadata?.phone_number_id) ?? getString(metadata?.display_phone_number);
  const providerMessageId = getString(message.id);
  const profileName = getString(readObject(contacts[0]?.profile)?.name);

  if (messageType === "text") {
    return {
      kind: "text",
      from,
      to,
      body: getString(readObject(message.text)?.body) ?? "",
      profileName,
      providerMessageId,
      rawPayload: message
    };
  }

  if (messageType === "location") {
    const location = parseMetaLocation(readObject(message.location));

    return {
      kind: "location",
      from,
      to,
      body: "",
      profileName,
      providerMessageId,
      location,
      rawPayload: message
    };
  }

  return {
    kind: "unknown",
    from,
    to,
    body: "",
    profileName,
    providerMessageId,
    rawPayload: message
  };
}

function parseMetaStatus(status: Record<string, unknown>): WhatsAppBusinessStatusCallback {
  return {
    providerMessageId: getString(status.id),
    recipientId: getString(status.recipient_id),
    status: getString(status.status),
    timestamp: getString(status.timestamp),
    rawPayload: status
  };
}

function parseMetaLocation(value: Record<string, unknown> | null): WhatsAppMessageLocation | null {
  const latitude = getNumber(value?.latitude);
  const longitude = getNumber(value?.longitude);

  if (latitude == null || longitude == null) {
    return null;
  }

  const address = getString(value?.address);
  const name = getString(value?.name);

  return {
    latitude,
    longitude,
    label: [name, address].filter(Boolean).join(" · ") || null
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getObjectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(readObject(item)))
    : [];
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}
