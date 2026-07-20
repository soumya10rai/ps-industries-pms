import { DashboardShell } from "@/components/DashboardShell";

export default function AdminPage() {
  return (
    <DashboardShell
      title="Admin"
      description="Oversee users, roles, and plant-wide operations."
      role="admin"
    >
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Pending role assignments" value="—" />
        <Stat label="Active plants" value="—" />
        <Stat label="Open production orders" value="—" />
      </section>
      <p className="mt-8 text-sm text-steel-500">
        Assign roles in Firestore at{" "}
        <code className="rounded bg-steel-100 px-1.5 py-0.5 text-steel-800">
          /users/&#123;uid&#125;
        </code>{" "}
        (field <code className="rounded bg-steel-100 px-1.5 py-0.5">role</code>
        ), or call{" "}
        <code className="rounded bg-steel-100 px-1.5 py-0.5 text-steel-800">
          POST /api/auth/seed
        </code>{" "}
        with an admin session or <code className="rounded bg-steel-100 px-1.5 py-0.5">x-seed-secret</code>.
      </p>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-steel-200 bg-white/90 p-5">
      <p className="text-sm text-steel-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-steel-900">
        {value}
      </p>
    </div>
  );
}
