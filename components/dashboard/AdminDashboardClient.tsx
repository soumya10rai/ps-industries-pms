"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import {
  displayCount,
  formatRelativeTime,
  type AdminDashboardKpis,
} from "@/lib/dashboard-types";
import { formatINR } from "@/lib/types";

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

interface AdminDashboardClientProps {
  title?: string;
  subtitle?: string;
  showAdminLinks?: boolean;
}

export default function AdminDashboardClient({
  title = "Dashboard",
  subtitle = "Plant-wide overview for Greater Noida — orders, inventory, and production at a glance.",
  showAdminLinks = false,
}: AdminDashboardClientProps) {
  const [kpis, setKpis] = useState<AdminDashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/kpis?role=admin", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load dashboard KPIs.");
      }
      if (data.role === "admin" && data.kpis) {
        setKpis(data.kpis as AdminDashboardKpis);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard."
      );
      // Keep last-known kpis on refresh failure — never clear to blank.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const d = kpis;

  return (
    <div className="ps-section">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            {showAdminLinks ? (
              <>
                <Link href="/dashboard" className="btn-secondary">
                  Main Dashboard
                </Link>
                <Link href="/accountant/po-list" className="btn-primary">
                  Manage Orders
                </Link>
              </>
            ) : (
              <Link href="/accountant/po-upload" className="btn-primary">
                Upload PO
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg border border-ps-red/30 bg-red-50 px-4 py-3 text-sm text-ps-red">
          {error}
          {d ? " Showing last known values." : ""}
        </p>
      )}

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard
          label="Open PO Value"
          value={displayMoney(d?.openPoValue)}
          description="New, approved & in production"
          loading={loading && !d}
        />
        <KPICard
          label="Pending Approvals"
          value={displayCount(d?.pendingApprovals)}
          description="Awaiting Plant Head review"
          badge="red"
          loading={loading && !d}
        />
        <KPICard
          label="Total Materials"
          value={displayCount(d?.totalMaterials)}
          description="Active raw materials"
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
          label="Dispatches This Month"
          value={displayCount(d?.dispatchesThisMonth)}
          description="Created in current month"
          loading={loading && !d}
        />
        <KPICard
          label="Dispatch Shortfalls"
          value={displayCount(d?.dispatchShortfalls)}
          description="Shortfall lines this month"
          badge="amber"
          loading={loading && !d}
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between border-b border-ps-navy/20 pb-3">
          <h2 className="ps-heading-accent font-serif text-ps-h2 text-ps-navy">
            Recent Purchase Orders
          </h2>
          <Link
            href="/accountant/po-list"
            className="text-sm font-semibold text-ps-navy transition duration-200 ease-in-out hover:underline"
          >
            View all
          </Link>
        </div>
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
                <Td className="font-medium">{formatINR(po.total)}</Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td>{po.date}</Td>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>

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
            Recent Activity
          </h2>
          {loading && !d ? (
            <TableSkeleton cols={1} rows={6} />
          ) : (d?.recentActivity?.length ?? 0) === 0 ? (
            <p className="text-sm text-ps-gray-500">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-ps-gray-100 rounded-lg border border-ps-gray-100 bg-white">
              {d!.recentActivity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="text-ps-navy">{a.text}</span>
                  <span className="shrink-0 text-ps-gray-500">
                    {formatRelativeTime(a.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
