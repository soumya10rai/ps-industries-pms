import type { POStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  pending: "bg-amber-100 text-amber-900 ring-amber-300",
  approved: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  rejected: "bg-red-100 text-red-900 ring-red-300",
  in_production: "bg-blue-100 text-blue-900 ring-blue-300",
  completed: "bg-ps-gray-100 text-ps-gray-800 ring-ps-gray-300",
  material_check: "bg-violet-100 text-violet-900 ring-violet-300",
  scheduled: "bg-sky-100 text-sky-900 ring-sky-300",
  running: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  paused: "bg-amber-100 text-amber-900 ring-amber-300",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
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
