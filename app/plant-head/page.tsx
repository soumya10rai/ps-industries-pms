import { DashboardShell } from "@/components/DashboardShell";

export default function PlantHeadPage() {
  return (
    <DashboardShell
      title="Plant Head"
      description="Monitor plant performance, shifts, and throughput."
      role="plant_head"
    >
      <p className="mt-6 text-steel-600">
        Welcome to the plant operations dashboard. Shift reports and KPIs will
        appear here.
      </p>
    </DashboardShell>
  );
}
