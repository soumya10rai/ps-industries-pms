"use client";

import { useCallback, useEffect, useState } from "react";
import KPICard from "@/components/KPICard";
import { formatINR } from "@/lib/types";

interface KPIState {
  openPOValue: number | null;
  pendingApprovals: number | null;
  lowStockCount: number | null;
  activeRunsCount: number | null;
}

const EMPTY_KPIS: KPIState = {
  openPOValue: null,
  pendingApprovals: null,
  lowStockCount: null,
  activeRunsCount: null,
};

/**
 * Shared live KPI grid used by /dashboard and /admin/dashboard.
 * Fetches from /api/dashboard/kpis (Firestore via Admin SDK).
 */
export default function DashboardKPICards() {
  const [kpis, setKpis] = useState<KPIState>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchKPIs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/kpis", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error loading data");
      }

      setKpis({
        openPOValue: Number(data.kpis.openPOValue ?? 0),
        pendingApprovals: Number(data.kpis.pendingApprovals ?? 0),
        lowStockCount: Number(data.kpis.lowStockCount ?? 0),
        activeRunsCount: Number(data.kpis.activeRunsCount ?? 0),
      });
    } catch (err) {
      console.error("[DashboardKPICards]", err);
      setError("Error loading data");
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchKPIs(false);
  }, [fetchKPIs]);

  const cardError = error;
  const isLoading = loading;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void fetchKPIs(true)}
          disabled={loading || refreshing}
          className="rounded border border-ps-navy bg-white px-3 py-1.5 text-sm font-semibold text-ps-navy transition hover:bg-ps-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Open PO Value"
          value={
            kpis.openPOValue === null ? "—" : formatINR(kpis.openPOValue)
          }
          description="Approved POs in po_uploads"
          isLoading={isLoading}
          error={cardError}
        />
        <KPICard
          label="Pending Approvals"
          value={kpis.pendingApprovals ?? "—"}
          description="POs with status new"
          isLoading={isLoading}
          error={cardError}
        />
        <KPICard
          label="Inventory / Low Stock"
          value={kpis.lowStockCount ?? "—"}
          description="current_qty below 5,000"
          isLoading={isLoading}
          error={cardError}
        />
        <KPICard
          label="Active Runs"
          value={kpis.activeRunsCount ?? "—"}
          description="Runs in progress"
          isLoading={isLoading}
          error={cardError}
        />
      </div>
    </div>
  );
}
