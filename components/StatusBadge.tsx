import type { POStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ps-gray-100 text-ps-gray-700 ring-ps-gray-300",
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  pending: "bg-amber-100 text-amber-900 ring-amber-300",
  approved: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  rejected: "bg-red-100 text-red-900 ring-red-300",
  in_production: "bg-blue-100 text-blue-900 ring-blue-300",
  dispatched: "bg-indigo-100 text-indigo-900 ring-indigo-300",
  completed: "bg-ps-gray-100 text-ps-gray-800 ring-ps-gray-300",
  material_check: "bg-violet-100 text-violet-900 ring-violet-300",
  scheduled: "bg-sky-100 text-sky-900 ring-sky-300",
  running: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  paused: "bg-amber-100 text-amber-900 ring-amber-300",
  // Dispatch variance statuses
  on_track: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  shortfall: "bg-red-100 text-red-900 ring-red-300",
  excess: "bg-amber-100 text-amber-900 ring-amber-300",
  complete: "bg-ps-gray-100 text-ps-gray-800 ring-ps-gray-300",
  processing: "bg-sky-100 text-sky-900 ring-sky-300",
  failed: "bg-red-100 text-red-900 ring-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  new: "Submitted",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_production: "In Production",
  dispatched: "Dispatched",
  completed: "Completed",
  material_check: "Material Check",
  scheduled: "Scheduled",
  running: "Running",
  paused: "Paused",
  on_track: "On Track",
  shortfall: "Shortfall",
  excess: "Excess",
  complete: "Complete",
  processing: "Processing",
  failed: "Failed",
};

interface StatusBadgeProps {
  status: POStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? "bg-ps-gray-100 text-ps-gray-800 ring-ps-gray-300";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition duration-200 ease-in-out ${style}`}
    >
      {label}
    </span>
  );
}
