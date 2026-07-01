import type { AiCaptureResult } from "@/types";

export type AiCaptureProvider = {
  captureTransferRequest(input: {
    message: string;
    previousData?: Record<string, unknown>;
  }): Promise<AiCaptureResult>;
};
