import { DashboardShell } from "@/components/DashboardShell";

export default function ProductionPage() {
  return (
    <DashboardShell
      title="Production"
      description="Plan work orders, lines, and daily output."
      role="production_head"
    >
      <p className="mt-6 text-steel-600">
        Production scheduling and work-order tracking will appear in this area.
      </p>
    </DashboardShell>
  );
}
