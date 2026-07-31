"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import {
  DISPATCH_PLANTS,
  DISPATCH_STATUS_LABELS,
  type DispatchItem,
  type DispatchLineStatus,
} from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

type StatusFilter = "" | DispatchLineStatus;

function readQueryParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function DispatchListPage() {
  const { role } = useAuth();
  const canUpload =
    role === "admin" || role === "accountant" || role === "plant_head";
  const canPdf =
    role === "admin" || role === "plant_head" || role === "accountant";

  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [plant, setPlant] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [uploadId, setUploadId] = useState("");
  const [kpis, setKpis] = useState({
    total: 0,
    shortfallCount: 0,
    excessCount: 0,
    onTrackCount: 0,
    completeCount: 0,
    totalPlanned: 0,
    totalDispatched: 0,
    totalVariance: 0,
    totalVariancePercent: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (plant) params.set("plant", plant);
      if (customer) params.set("customer", customer);
      if (status) params.set("status", status);
      if (uploadId) params.set("uploadId", uploadId);

      const res = await fetch(`/api/dispatch/list?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dispatches.");
      setDispatches(Array.isArray(data.dispatches) ? data.dispatches : []);
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setDispatches([]);
    } finally {
      setLoading(false);
    }
  }, [plant, customer, status, uploadId]);

  useEffect(() => {
    const id = readQueryParam("uploadId");
    if (id) setUploadId(id);
    if (readQueryParam("uploaded") === "1") {
      setToast("Dispatch Excel uploaded successfully.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const varianceLabel = useMemo(() => {
    const sign = kpis.totalVariance >= 0 ? "+" : "";
    return `This period: ${fmt(kpis.totalPlanned)} planned → ${fmt(kpis.totalDispatched)} dispatched (${sign}${kpis.totalVariancePercent.toFixed(1)}%)`;
  }, [kpis]);

  async function downloadPdf() {
    try {
      const params = new URLSearchParams();
      if (plant) params.set("plant", plant);
      if (uploadId) params.set("uploadId", uploadId);
      const res = await fetch(`/api/dispatch/pdf?${params}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "PDF export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dispatch-variance.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setToast("Variance report PDF downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} type="success" />
      )}

      <PageHeader
        title="Dispatch"
        subtitle="Plan vs actual reconciliation across plants — independent of POs."
        actions={
          <>
            <Link
              href="/dispatch/variance-report"
              className="text-sm font-semibold text-ps-navy hover:underline"
            >
              Variance Report
            </Link>
            <Link
              href="/dispatch/uploads"
              className="text-sm font-semibold text-ps-navy hover:underline"
            >
              Upload History
            </Link>
            {canPdf && (
              <Button variant="secondary" onClick={() => void downloadPdf()}>
                Download Variance Report PDF
              </Button>
            )}
            {canUpload && (
              <Link href="/dispatch/upload">
                <Button>Upload Excel</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ps-gray-200 bg-white p-4 shadow-card">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Plant
          </span>
          <select
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All plants</option>
            {DISPATCH_PLANTS.filter((p) => p !== "All").map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Customer
          </span>
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {(Object.keys(DISPATCH_STATUS_LABELS) as DispatchLineStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {DISPATCH_STATUS_LABELS[s]}
                </option>
              )
            )}
          </select>
        </label>

        {uploadId && (
          <Button
            variant="ghost"
            onClick={() => setUploadId("")}
            className="text-xs"
          >
            Clear upload filter
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Total Dispatches" value={kpis.total} />
        <KPICard
          label="On Track"
          value={kpis.onTrackCount + kpis.completeCount}
          description={`${kpis.completeCount} complete · ${kpis.onTrackCount} small excess`}
        />
        <KPICard
          label="Shortfalls"
          value={kpis.shortfallCount}
          description="Planned qty exceeded actual"
        />
        <KPICard
          label="Excess"
          value={kpis.excessCount}
          description="Over 5% above plan"
        />
      </div>

      <div className="rounded-lg border border-ps-gray-200 bg-white p-4 shadow-card">
        <p className="text-sm font-medium text-ps-navy">{varianceLabel}</p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading dispatches…</p>
      ) : dispatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-gray-300 bg-white p-10 text-center">
          <p className="text-ps-navy">No dispatch records yet.</p>
          {canUpload && (
            <Link
              href="/dispatch/upload"
              className="mt-3 inline-block text-sm font-semibold text-ps-navy underline"
            >
              Upload a Schedule vs Despatch Excel
            </Link>
          )}
        </div>
      ) : (
        <DataTable
          headers={[
            "Customer",
            "Item Code",
            "Description",
            "Plant",
            "Planned",
            "Actual",
            "Variance",
            "%",
            "Status",
          ]}
        >
          {dispatches.map((row, index) => (
            <TableRow
              key={row.dispatchId}
              index={index}
              className={
                row.status === "shortfall"
                  ? "!bg-red-50 hover:!bg-red-100/80"
                  : row.status === "excess"
                    ? "!bg-amber-50 hover:!bg-amber-100/80"
                    : ""
              }
            >
              <Td>{row.customer}</Td>
              <Td className="font-mono text-xs">{row.itemCode}</Td>
              <Td className="max-w-[220px] truncate">{row.itemDescription}</Td>
              <Td>{row.plant}</Td>
              <Td className="tabular-nums">{fmt(row.plannedQuantity)}</Td>
              <Td className="tabular-nums">{fmt(row.actualQuantity)}</Td>
              <Td
                className={`tabular-nums font-semibold ${
                  row.variance < 0
                    ? "text-red-700"
                    : row.variance > 0
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {row.variance > 0 ? "+" : ""}
                {fmt(row.variance)}
              </Td>
              <Td className="tabular-nums">
                {row.variancePercent > 0 ? "+" : ""}
                {row.variancePercent.toFixed(1)}%
              </Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
