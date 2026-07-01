import type { TransferRequestStatus } from "./status";

export type StatusHistoryEntry = {
  id: string;
  transferRequestId: string;
  fromStatus?: TransferRequestStatus | null;
  toStatus: TransferRequestStatus;
  reason?: string | null;
  changedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};
