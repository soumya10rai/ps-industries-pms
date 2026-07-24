import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { getHomeForRole } from "@/lib/auth";
import { getServerSession } from "@/lib/server-auth";
import {
  MOCK_INVENTORY,
  MOCK_POS,
  MOCK_PRODUCTION_RUNS,
} from "@/lib/mock-data";
import {
  ROLE_HOME,
  ROLE_LABELS,
  formatINR,
  isUserRole,
  type UserRole,
} from "@/lib/types";

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "admin",
  plant_head: "plant_head",
  "plant-head": "plant_head",
  accountant: "accountant",
  store: "store_manager",
  store_manager: "store_manager",
  production: "production_head",
  production_head: "production_head",
};

export default async function RoleDashboardPage({
  params,
}: {
  params: { role: string };
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth/login");

  const roleKey = ROLE_ALIASES[params.role];
  if (!roleKey || !isUserRole(roleKey)) notFound();

  if (session.role !== "admin" && session.role !== roleKey) {
    redirect(getHomeForRole(session.role));
  }

  return <RoleDashboard role={roleKey} />;
}

function RoleDashboard({ role }: { role: UserRole }) {
  const title = `${ROLE_LABELS[role]} Dashboard`;
  const home = ROLE_HOME[role];

  if (role === "admin") {
    return (
      <div className="ps-section">
        <PageHeader
          title={title}
          subtitle="Full plant control — users, approvals, inventory, and production."
          actions={
            <Link href="/admin/dashboard" className="btn-primary">
              Admin Overview
            </Link>
          }
        />
        <AdminKPIs />
      </div>
    );
  }

  if (role === "accountant") {
    return (
      <div className="ps-section">
        <PageHeader
          title={title}
          subtitle="Upload, validate, and track purchase orders for the plant."
          actions={
            <Link href={home} className="btn-primary">
              Open PO List
            </Link>
          }
        />
        <div className="grid gap-8 sm:grid-cols-3">
          <KPICard
            label="PO Value"
            value={formatINR(
              MOCK_POS.reduce((s, p) => s + p.total_amount, 0)
            )}
            description="All uploaded POs"
          />
          <KPICard
            label="Pending"
            value={MOCK_POS.filter((p) => p.status === "pending").length}
            description="Awaiting approval"
          />
          <KPICard
            label="Customers"
            value={new Set(MOCK_POS.map((p) => p.customer_code)).size}
            description="Active buyer accounts"
          />
        </div>
        <POMiniTable />
      </div>
    );
  }

  if (role === "plant_head") {
    return (
      <div className="ps-section">
        <PageHeader
          title={title}
          subtitle="Approve purchase orders and verify material readiness."
          actions={
            <Link href="/plant-head/approvals" className="btn-primary">
              Review Approvals
            </Link>
          }
        />
        <div className="grid gap-8 sm:grid-cols-3">
          <KPICard
            label="Pending Approvals"
            value={MOCK_POS.filter((p) => p.status === "pending").length}
          />
          <KPICard
            label="Material Checks"
            value={MOCK_POS.filter((p) => p.status === "material_check").length}
          />
          <KPICard
            label="Approved Value"
            value={formatINR(
              MOCK_POS.filter((p) => p.status === "approved").reduce(
                (s, p) => s + p.total_amount,
                0
              )
            )}
          />
        </div>
        <POMiniTable />
      </div>
    );
  }

  if (role === "store_manager") {
    return (
      <div className="ps-section">
        <PageHeader
          title={title}
          subtitle="Monitor stock levels and fulfill material requests."
          actions={
            <Link href="/store/inventory" className="btn-primary">
              Open Inventory
            </Link>
          }
        />
        <div className="grid gap-8 sm:grid-cols-3">
          <KPICard label="SKUs" value={MOCK_INVENTORY.length} />
          <KPICard
            label="Low Stock"
            value={
              MOCK_INVENTORY.filter((i) => i.quantity <= i.reorder_level).length
            }
          />
          <KPICard
            label="Locations"
            value={new Set(MOCK_INVENTORY.map((i) => i.location)).size}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ps-section">
      <PageHeader
        title={title}
        subtitle="Schedule and track injection moulding production runs."
        actions={
          <Link href="/production/runs" className="btn-primary">
            View Runs
          </Link>
        }
      />
      <div className="grid gap-8 sm:grid-cols-3">
        <KPICard
          label="Running"
          value={MOCK_PRODUCTION_RUNS.filter((r) => r.status === "running").length}
        />
        <KPICard
          label="Scheduled"
          value={
            MOCK_PRODUCTION_RUNS.filter((r) => r.status === "scheduled").length
          }
        />
        <KPICard
          label="Completed"
          value={
            MOCK_PRODUCTION_RUNS.filter((r) => r.status === "completed").length
          }
        />
      </div>
    </div>
  );
}

function AdminKPIs() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label="Total PO Value"
        value={formatINR(MOCK_POS.reduce((s, p) => s + p.total_amount, 0))}
      />
      <KPICard label="Purchase Orders" value={MOCK_POS.length} />
      <KPICard label="Inventory SKUs" value={MOCK_INVENTORY.length} />
      <KPICard label="Production Runs" value={MOCK_PRODUCTION_RUNS.length} />
    </div>
  );
}

function POMiniTable() {
  return (
    <section>
      <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
        Purchase Orders
      </h2>
      <DataTable headers={["PO", "Customer", "Total", "Status"]}>
        {MOCK_POS.map((po, i) => (
          <TableRow key={po.id} index={i}>
            <Td className="font-semibold text-ps-navy">{po.po_number}</Td>
            <Td>{po.customer_code}</Td>
            <Td>{formatINR(po.total_amount)}</Td>
            <Td>
              <StatusBadge status={po.status} />
            </Td>
          </TableRow>
        ))}
      </DataTable>
    </section>
  );
}
