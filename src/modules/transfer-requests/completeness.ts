import { requiredTransferRequestFields } from "@/lib/validators/transfer-request";
import type { TransferRequest, TransferRequestCompleteness } from "@/types";

export function getTransferRequestCompleteness(
  request: Partial<TransferRequest>
): TransferRequestCompleteness {
  const missingFields = requiredTransferRequestFields.filter((field) => {
    const value = request[field];
    return value === undefined || value === null || value === "";
  });

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
}
