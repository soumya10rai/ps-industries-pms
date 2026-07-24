import type { POStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  in_production: "bg-blue-50 text-blue-800 ring-blue-200",
  completed: "bg-ps-gray-100 text-ps-gray-700 ring-ps-gray-200",
  material_check: "bg-violet-50 text-violet-800 ring-violet-200",
  scheduled: "bg-sky-50 text-sky-800 ring-sky-200",
  running: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  paused: "bg-amber-50 text-amber-800 ring-amber-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_production: "In Production",
  completed: "Completed",
  material_check: "Material Check",
  scheduled: "Scheduled",
  running: "Running",
  paused: "Paused",
};

interface StatusBadgeProps {
  status: POStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? "bg-ps-gray-100 text-ps-gray-700 ring-ps-gray-200";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
