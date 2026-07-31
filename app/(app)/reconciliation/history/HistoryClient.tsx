"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

interface HistoryRow {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  plant: string;
  generatedAt: string;
  generatedByName?: string;
  totalVarianceKg: number;
  totalVariancePercent: number;
  alertCount: number;
  attentionCount: number;
  healthyCount: number;
  materialsAnalyzed: number;
}

function overallStatus(row: HistoryRow): string {
  if (row.alertCount > 0) return "alert";
  if (row.attentionCount > 0) return "attention";
  if (row.materialsAnalyzed === 0) return "unmapped";
  return "healthy";
}

function fmtKg(n: number): string {
  return `${n >= 0 ? "+" : ""}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(n)} kg`;
}

export default function ReconciliationHistoryClient({
  serverRole = null,
}: {
  serverRole?: UserRole | null;
}) {
  const { role: clientRole } = useAuth();
  const role = clientRole ?? serverRole;
  const canWrite = role === "admin" || role === "plant_head";
  const canRead =
    role === "admin" ||
    role === "plant_head" ||
    role === "store_manager" ||
    role === "production_head";

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/reports?limit=50", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load history.");
      setRows(json.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf(reportId: string, periodStart: string, periodEnd: string) {
    try {
      const res = await fetch(
        `/api/reconciliation/export/${encodeURIComponent(reportId)}`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "PDF export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation-${periodStart}-${periodEnd}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("PDF downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    }
  }

  async function remove(reportId: string) {
    if (!canWrite) return;
    if (!window.confirm("Delete this cached reconciliation report?")) return;
    try {
      const res = await fetch(
        `/api/reconciliation/report/${encodeURIComponent(reportId)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Delete failed.");
      setToast("Report deleted.");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  if (!canRead) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        You do not have access to reconciliation history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} type="success" />
      )}

      <PageHeader
        title="Reconciliation History"
        subtitle="Previously generated material reconciliation reports."
        actions={
          canWrite ? (
            <Link href="/reconciliation">
              <Button>New Report</Button>
            </Link>
          ) : (
            <Link
              href="/reconciliation"
              className="text-sm font-semibold text-ps-navy"
            >
              ← View reports
            </Link>
          )
        }
      />

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading history…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-serif text-lg text-ps-navy">No reports yet</p>
          <p className="mt-2 text-sm text-ps-gray-500">
            {canWrite
              ? "Generate a reconciliation report to see it here."
              : "No cached reports available."}
          </p>
        </div>
      ) : (
        <DataTable
          headers={[
            "Generated",
            "Period",
            "Plant",
            "Total Variance",
            "Status",
            "Actions",
          ]}
        >
          {rows.map((row, i) => (
            <TableRow key={row.reportId} index={i}>
              <Td>
                <div className="text-sm">
                  {row.generatedAt
                    ? new Date(row.generatedAt).toLocaleString("en-IN")
                    : "—"}
                </div>
                {row.generatedByName && (
                  <div className="text-xs text-ps-gray-500">
                    {row.generatedByName}
                  </div>
                )}
              </Td>
              <Td>
                {row.periodStart} → {row.periodEnd}
              </Td>
              <Td>{row.plant || "All"}</Td>
              <Td className="tabular-nums">
                <div className="font-semibold">{fmtKg(row.totalVarianceKg)}</div>
                <div className="text-xs text-ps-gray-500">
                  {row.totalVariancePercent >= 0 ? "+" : ""}
                  {row.totalVariancePercent.toFixed(1)}%
                </div>
              </Td>
              <Td>
                <StatusBadge status={overallStatus(row)} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/reconciliation?reportId=${encodeURIComponent(row.reportId)}`}
                    className="text-sm font-semibold text-ps-navy hover:underline"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    className="text-sm font-semibold text-ps-navy hover:underline"
                    onClick={() =>
                      void downloadPdf(
                        row.reportId,
                        row.periodStart,
                        row.periodEnd
                      )
                    }
                  >
                    PDF
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-700 hover:underline"
                      onClick={() => void remove(row.reportId)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </Td>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
