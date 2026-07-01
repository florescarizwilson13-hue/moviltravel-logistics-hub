import { TRANSFER_REQUEST_STATUS_LABELS } from "@/lib/constants/statuses";
import type { TransferRequestStatus } from "@/types";
import { cn } from "@/utils/cn";

const statusClasses: Record<TransferRequestStatus, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700",
  incomplete: "border-amber-300 bg-amber-50 text-amber-800",
  pending_review: "border-sky-300 bg-sky-50 text-sky-800",
  ready_to_assign: "border-emerald-300 bg-emerald-50 text-emerald-800",
  assigned: "border-indigo-300 bg-indigo-50 text-indigo-800",
  confirmed: "border-cyan-300 bg-cyan-50 text-cyan-800",
  in_progress: "border-blue-300 bg-blue-50 text-blue-800",
  completed: "border-zinc-300 bg-zinc-50 text-zinc-800",
  cancelled: "border-red-300 bg-red-50 text-red-800"
};

export function RequestStatusBadge({ status }: { status: TransferRequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        statusClasses[status]
      )}
    >
      {TRANSFER_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
