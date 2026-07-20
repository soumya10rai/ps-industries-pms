import { DashboardShell } from "@/components/DashboardShell";

export default function AccountantPage() {
  return (
    <DashboardShell
      title="Accountant"
      description="Manage invoices, costs, and financial close."
      role="accountant"
    >
      <p className="mt-6 text-steel-600">
        Financial workflows and cost centers will be available in this workspace.
      </p>
    </DashboardShell>
  );
}
