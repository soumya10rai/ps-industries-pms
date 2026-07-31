"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import AdminDashboardClient from "@/components/dashboard/AdminDashboardClient";
import {
  displayCount,
  formatRelativeTime,
  type AccountantDashboardKpis,
  type PlantHeadDashboardKpis,
  type ProductionHeadDashboardKpis,
  type StoreManagerDashboardKpis,
} from "@/lib/dashboard-types";
import {
  ROLE_HOME,
  ROLE_LABELS,
  formatINR,
  type UserRole,
} from "@/lib/types";

function displayMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return formatINR(n);
}

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-ps-gray-100 bg-white p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={j}
              className="h-4 flex-1 animate-pulse rounded bg-ps-gray-100"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({
  error,
  hasCache,
}: {
  error: string | null;
  hasCache: boolean;
}) {
  if (!error) return null;
  return (
    <p className="mb-4 rounded-lg border border-ps-red/30 bg-red-50 px-4 py-3 text-sm text-ps-red">
      {error}
      {hasCache ? " Showing last known values." : ""}
    </p>
  );
}

function PlantHeadView({
  kpis,
  loading,
}: {
  kpis: PlantHeadDashboardKpis | null;
  loading: boolean;
}) {
  const d = kpis;
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Pending Approvals"
          value={displayCount(d?.pendingApprovals)}
          description="Main focus — awaiting review"
          badge="red"
          loading={loading && !d}
        />
        <KPICard
          label="Low Stock Alerts"
          value={displayCount(d?.lowStockAlerts)}
          description="Below reorder level"
          badge="red"
          loading={loading && !d}
        />
        <KPICard
          label="Recon Alerts"
          value={displayCount(d?.reconAlerts)}
          description="Materials with variance > 15%"
          badge="amber"
          loading={loading && !d}
        />
        <KPICard
          label="Recent Dispatches"
          value={displayCount(d?.recentDispatches?.length)}
          description="Latest dispatch lines"
          loading={loading && !d}
        />
      </div>

      <section>
        <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
          Pending Purchase Orders
        </h2>
        {loading && !d ? (
          <TableSkeleton cols={5} />
        ) : (d?.recentPos?.length ?? 0) === 0 ? (
          <p className="text-sm text-ps-gray-500">No pending approvals.</p>
        ) : (
          <DataTable
            headers={["PO Number", "Customer", "Total", "Status", "Date"]}
          >
            {d!.recentPos.map((po, i) => (
              <TableRow key={po.id} index={i}>
                <Td className="font-semibold text-ps-navy">{po.poNumber}</Td>
                <Td>{po.customer}</Td>
                <Td>{formatINR(po.total)}</Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td>{po.date}</Td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
          Recent Dispatches
        </h2>
        {loading && !d ? (
          <TableSkeleton cols={4} />
        ) : (d?.recentDispatches?.length ?? 0) === 0 ? (
          <p className="text-sm text-ps-gray-500">No recent dispatches.</p>
        ) : (
          <DataTable
            headers={["Customer", "Item", "Actual / Planned", "Status"]}
          >
            {d!.recentDispatches.map((row, i) => (
              <TableRow key={row.dispatchId} index={i}>
                <Td className="font-semibold text-ps-navy">{row.customer}</Td>
                <Td className="max-w-[220px] truncate">
                  {row.itemDescription || "—"}
                </Td>
                <Td>
                  {row.actualQuantity.toLocaleString("en-IN")} /{" "}
                  {row.plannedQuantity.toLocaleString("en-IN")}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}

function AccountantView({
  kpis,
  loading,
}: {
  kpis: AccountantDashboardKpis | null;
  loading: boolean;
}) {
  const d = kpis;
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-3">
        <KPICard
          label="My Draft POs"
          value={displayCount(d?.draftPos)}
          description="Unsubmitted drafts"
          loading={loading && !d}
        />
        <KPICard
          label="My Submitted POs"
          value={displayCount(d?.submittedLast30Days)}
          description="Last 30 days"
          loading={loading && !d}
        />
        <KPICard
          label="Open PO Value"
          value={displayMoney(d?.openPoValue)}
          description="New, approved & in production"
          loading={loading && !d}
        />
      </div>

      <section>
        <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
          Recent PO Uploads
        </h2>
        {loading && !d ? (
          <TableSkeleton cols={5} />
        ) : (d?.recentPos?.length ?? 0) === 0 ? (
          <p className="text-sm text-ps-gray-500">No purchase orders yet.</p>
        ) : (
          <DataTable
            headers={["PO Number", "Customer", "Total", "Status", "Date"]}
          >
            {d!.recentPos.map((po, i) => (
              <TableRow key={po.id} index={i}>
                <Td className="font-semibold text-ps-navy">{po.poNumber}</Td>
                <Td>{po.customer}</Td>
                <Td>{formatINR(po.total)}</Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td>{po.date}</Td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}

function StoreManagerView({
  kpis,
  loading,
}: {
  kpis: StoreManagerDashboardKpis | null;
  loading: boolean;
}) {
  const d = kpis;
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-3">
        <KPICard
          label="Total Materials"
          value={displayCount(d?.totalMaterials)}
          description="Active raw materials"
          loading={loading && !d}
        />
        <KPICard
          label="Low Stock Alerts"
          value={displayCount(d?.lowStockAlerts)}
          description="Requires store action"
          badge="red"
          loading={loading && !d}
        />
        <KPICard
          label="Latest Inventory Upload"
          value={
            d?.latestInventoryUploadAt
              ? formatRelativeTime(d.latestInventoryUploadAt)
              : "—"
          }
          description={
            d?.latestInventoryUploadAt
              ? d.latestInventoryUploadAt.slice(0, 19).replace("T", " ")
              : "No uploads yet"
          }
          loading={loading && !d}
        />
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Low Stock Alerts
          </h2>
          {loading && !d ? (
            <TableSkeleton cols={4} />
          ) : (d?.lowStockItems?.length ?? 0) === 0 ? (
            <p className="text-sm text-ps-gray-500">No low-stock materials.</p>
          ) : (
            <DataTable
              headers={[
                "Material",
                "Current Stock",
                "Reorder Level",
                "Deficit",
              ]}
            >
              {d!.lowStockItems.map((item, i) => (
                <TableRow key={item.materialCode} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {item.materialName}
                  </Td>
                  <Td className="font-semibold text-ps-red">
                    {item.currentStockKg.toLocaleString("en-IN")} kg
                  </Td>
                  <Td>
                    {item.reorderLevelKg.toLocaleString("en-IN")} kg
                  </Td>
                  <Td>
                    {item.deficitKg.toLocaleString("en-IN")} kg
                  </Td>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>

        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Recent Movements (7 days)
          </h2>
          {loading && !d ? (
            <TableSkeleton cols={4} />
          ) : (d?.recentMovements?.length ?? 0) === 0 ? (
            <p className="text-sm text-ps-gray-500">
              No issues or receives in the last 7 days.
            </p>
          ) : (
            <DataTable headers={["Material", "Type", "Qty", "When"]}>
              {d!.recentMovements.map((m, i) => (
                <TableRow key={m.movementId} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {m.materialName}
                  </Td>
                  <Td className="capitalize">{m.type}</Td>
                  <Td>{m.quantityKg.toLocaleString("en-IN")} kg</Td>
                  <Td>{formatRelativeTime(m.createdAt)}</Td>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>
      </section>
    </>
  );
}

function ProductionHeadView({
  kpis,
  loading,
}: {
  kpis: ProductionHeadDashboardKpis | null;
  loading: boolean;
}) {
  const d = kpis;
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-3">
        <KPICard
          label="Approved POs Ready"
          value={displayCount(d?.approvedReady)}
          description="Ready for production"
          loading={loading && !d}
        />
        <KPICard
          label="Recent Dispatches"
          value={displayCount(d?.recentDispatches?.length)}
          description="Latest dispatch lines"
          loading={loading && !d}
        />
        <KPICard
          label="Materials Running Low"
          value={displayCount(d?.materialsRunningLow?.length)}
          description="May impact upcoming runs"
          badge="red"
          loading={loading && !d}
        />
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Recent Dispatches
          </h2>
          {loading && !d ? (
            <TableSkeleton cols={4} />
          ) : (d?.recentDispatches?.length ?? 0) === 0 ? (
            <p className="text-sm text-ps-gray-500">No recent dispatches.</p>
          ) : (
            <DataTable
              headers={["Customer", "Item", "Actual / Planned", "Status"]}
            >
              {d!.recentDispatches.map((row, i) => (
                <TableRow key={row.dispatchId} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {row.customer}
                  </Td>
                  <Td className="max-w-[180px] truncate">
                    {row.itemDescription || "—"}
                  </Td>
                  <Td>
                    {row.actualQuantity.toLocaleString("en-IN")} /{" "}
                    {row.plannedQuantity.toLocaleString("en-IN")}
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>

        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Materials Running Low
          </h2>
          {loading && !d ? (
            <TableSkeleton cols={4} />
          ) : (d?.materialsRunningLow?.length ?? 0) === 0 ? (
            <p className="text-sm text-ps-gray-500">Stock levels look healthy.</p>
          ) : (
            <DataTable
              headers={[
                "Material",
                "Current Stock",
                "Reorder Level",
                "Deficit",
              ]}
            >
              {d!.materialsRunningLow.map((item, i) => (
                <TableRow key={item.materialCode} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {item.materialName}
                  </Td>
                  <Td className="font-semibold text-ps-red">
                    {item.currentStockKg.toLocaleString("en-IN")} kg
                  </Td>
                  <Td>
                    {item.reorderLevelKg.toLocaleString("en-IN")} kg
                  </Td>
                  <Td>
                    {item.deficitKg.toLocaleString("en-IN")} kg
                  </Td>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>
      </section>
    </>
  );
}

const ROLE_SUBTITLES: Record<UserRole, string> = {
  admin: "Full plant control — users, approvals, inventory, and production.",
  plant_head: "Approve purchase orders and verify material readiness.",
  accountant: "Upload, validate, and track purchase orders for the plant.",
  store_manager: "Monitor stock levels and fulfill material requests.",
  production_head: "Schedule and track injection moulding production runs.",
};

const ROLE_CTAS: Record<UserRole, { href: string; label: string }> = {
  admin: { href: "/admin/dashboard", label: "Admin Overview" },
  plant_head: { href: "/plant-head/approvals", label: "Review Approvals" },
  accountant: { href: ROLE_HOME.accountant, label: "Open PO List" },
  store_manager: { href: "/store/inventory", label: "Open Inventory" },
  production_head: { href: "/production/runs", label: "View Runs" },
};

export default function RoleDashboardClient({ role }: { role: UserRole }) {
  if (role === "admin") {
    return (
      <AdminDashboardClient
        title={`${ROLE_LABELS.admin} Dashboard`}
        subtitle={ROLE_SUBTITLES.admin}
        showAdminLinks
      />
    );
  }

  return <RoleSpecificDashboard role={role} />;
}

function RoleSpecificDashboard({
  role,
}: {
  role: Exclude<UserRole, "admin">;
}) {
  const [kpis, setKpis] = useState<
    | PlantHeadDashboardKpis
    | AccountantDashboardKpis
    | StoreManagerDashboardKpis
    | ProductionHeadDashboardKpis
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/dashboard/kpis?role=${encodeURIComponent(role)}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load dashboard KPIs.");
        }
        if (data.role === role && data.kpis) {
          setKpis(data.kpis);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const cta = ROLE_CTAS[role];
  const title = `${ROLE_LABELS[role]} Dashboard`;

  return (
    <div className="ps-section">
      <PageHeader
        title={title}
        subtitle={ROLE_SUBTITLES[role]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Link href={cta.href} className="btn-primary">
              {cta.label}
            </Link>
          </div>
        }
      />

      <ErrorBanner error={error} hasCache={!!kpis} />

      {role === "plant_head" && (
        <PlantHeadView
          kpis={kpis as PlantHeadDashboardKpis | null}
          loading={loading}
        />
      )}
      {role === "accountant" && (
        <AccountantView
          kpis={kpis as AccountantDashboardKpis | null}
          loading={loading}
        />
      )}
      {role === "store_manager" && (
        <StoreManagerView
          kpis={kpis as StoreManagerDashboardKpis | null}
          loading={loading}
        />
      )}
      {role === "production_head" && (
        <ProductionHeadView
          kpis={kpis as ProductionHeadDashboardKpis | null}
          loading={loading}
        />
      )}
    </div>
  );
}
