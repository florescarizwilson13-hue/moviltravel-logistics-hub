import type {
  WhatsAppBusinessInteractiveButtonsPayload,
  WhatsAppBusinessInteractiveList,
  WhatsAppBusinessLocationPayload,
  WhatsAppBusinessTemplateMessage,
  WhatsAppInboundMessage
} from "./types";

const inactiveProviderMessage = "WhatsApp Business provider is not active yet";

export const WhatsAppBusinessProvider = {
  name: "whatsapp_business" as const,

  parseInboundWebhook(_input: unknown): WhatsAppInboundMessage {
    throw new Error(inactiveProviderMessage);
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
