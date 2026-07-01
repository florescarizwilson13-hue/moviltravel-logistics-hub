import {
  generateAssignmentWhatsappMessages,
  generateWhatsappMessage
} from "@/lib/messages/whatsapp";
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
  return generateAssignmentWhatsappMessages(request, driver);
}
