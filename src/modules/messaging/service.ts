import {
  generateAssignmentWhatsappMessages,
  generateWhatsappMessage
} from "@/lib/messages/whatsapp";
import { renderWhatsAppOutboundMessage } from "@/modules/whatsapp/outbound/renderer";
import type { Driver, MessageTemplate, TransferRequest } from "@/types";

export function prepareWhatsappMessage(
  request: Partial<TransferRequest>,
  template: MessageTemplate
) {
  return generateWhatsappMessage({
    request,
    template,
    recipientPhone: request.requesterPhone
  });
}

export function prepareAssignmentWhatsappMessages(request: TransferRequest, driver: Driver) {
  return generateAssignmentWhatsappMessages(request, driver).map((message) => {
    const audience = message.metadata?.audience;

    if (audience !== "passenger" && audience !== "driver") {
      return message;
    }

    const rendered = renderWhatsAppOutboundMessage({
      type: audience === "passenger" ? "passenger_assignment" : "driver_assignment",
      recipient: {
        type: audience,
        name: message.recipientName,
        phone: message.recipientPhone
      },
      context: {
        request,
        driver
      }
    });

    return {
      ...message,
      body: rendered.fallbackText
    };
  });
}
