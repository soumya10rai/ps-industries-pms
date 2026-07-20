import { DashboardShell } from "@/components/DashboardShell";

export default function StorePage() {
  return (
    <DashboardShell
      title="Store"
      description="Track inventory, receipts, and material issues."
      role="store_manager"
    >
      <p className="mt-6 text-steel-600">
        Store inventory and material movement tools will live here.
      </p>
    </DashboardShell>
  );
}
