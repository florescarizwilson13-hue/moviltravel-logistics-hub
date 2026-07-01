import type { CreateTransferRequestInput, TransferRequestStatus } from "@/types";
import { getTransferRequestCompleteness } from "./completeness";

export function resolveInitialTransferRequestStatus(
  input: CreateTransferRequestInput
): TransferRequestStatus {
  if (input.status) {
    return input.status;
  }

  const completeness = getTransferRequestCompleteness(input);
  return completeness.isComplete ? "pending_review" : "incomplete";
}
