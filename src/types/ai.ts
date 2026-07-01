import type { CreateTransferRequestInput } from "./transfer-request";
import type { TransferRequest } from "./transfer-request";

export type AiConversationStatus = "open" | "completed" | "cancelled";

export type AiConversation = {
  id: string;
  transferRequestId?: string | null;
  provider: "mock" | string;
  status: AiConversationStatus;
  capturedData: CreateTransferRequestInput;
  messages: AiConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AiConversationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type AiCaptureResult = {
  capturedData: CreateTransferRequestInput;
  missingFields: string[];
  assistantMessage: string;
  confidence: number;
  readyForReview: boolean;
  extractedFields: string[];
};

export type AiCompletionResult = AiCaptureResult & {
  mergedData: CreateTransferRequestInput;
  newlyAppliedFields: Array<keyof CreateTransferRequestInput>;
  skippedExistingFields: Array<keyof CreateTransferRequestInput>;
  missingFieldsAfterMerge: string[];
  readyForReviewAfterMerge: boolean;
};
