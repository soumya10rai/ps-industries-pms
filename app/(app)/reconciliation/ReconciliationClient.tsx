"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  DISPATCH_PLANTS,
  type MaterialVariance,
  type ReconciliationReport,
  type UserRole,
} from "@/lib/types";

const NAVY = "#1e3a8a";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#dc2626";

type StatusFilter = "all" | "alert" | "attention" | "healthy";
type SortKey =
  | "materialCode"
  | "materialGroup"
  | "expectedKg"
  | "actualKg"
  | "varianceKg"
  | "variancePercent"
  | "status";

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthBounds(offsetMonths: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1)
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 0)
  );
  return { start: toYmd(start), end: toYmd(end) };
}

function lastNDays(n: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - (n - 1));
  return { start: toYmd(start), end: toYmd(end) };
}

function fmtKg(n: number): string {
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(n)} kg`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function varianceColorClass(pct: number): string {
  const abs = Math.abs(pct);
  if (abs >= 15) return "text-red-700";
  if (abs >= 5) return "text-amber-700";
  return "text-emerald-700";
}

export default function ReconciliationClient({
  serverRole = null,
}: {
  serverRole?: UserRole | null;
}) {
  const { role: clientRole } = useAuth();
  const role = clientRole ?? serverRole;
  const searchParams = useSearchParams();
  const canGenerate = role === "admin" || role === "plant_head";
  const canRead =
    role === "admin" ||
    role === "plant_head" ||
    role === "store_manager" ||
    role === "production_head";

  const thisMonth = monthBounds(0);
  const [periodStart, setPeriodStart] = useState(thisMonth.start);
  const [periodEnd, setPeriodEnd] = useState(thisMonth.end);
  const [plant, setPlant] = useState("All");
  const [mode] = useState<"auto" | "manual">("auto");

  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [historyTrend, setHistoryTrend] = useState<
    Array<{ label: string; variancePercent: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cachedNote, setCachedNote] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("varianceKg");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drill, setDrill] = useState<MaterialVariance | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const loadReportById = useCallback(async (reportId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reconciliation/report/${encodeURIComponent(reportId)}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load report.");
      setReport(json.report);
      setPeriodStart(json.report.periodStart);
      setPeriodEnd(json.report.periodEnd);
      setPlant(json.report.plant || "All");
      setCachedNote(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    try {
      const res = await fetch("/api/reconciliation/reports?limit=12", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) return;
      const points = (json.reports || [])
        .slice()
        .reverse()
        .map(
          (r: {
            periodStart: string;
            periodEnd: string;
            totalVariancePercent: number;
          }) => ({
            label: `${r.periodStart.slice(5)}→${r.periodEnd.slice(5)}`,
            variancePercent: r.totalVariancePercent,
          })
        );
      setHistoryTrend(points);
    } catch {
      // optional chart
    }
  }, []);

  useEffect(() => {
    const id = searchParams?.get("reportId");
    if (id) void loadReportById(id);
    void loadTrend();
  }, [searchParams, loadReportById, loadTrend]);

  async function generate(regenerate = false) {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setShareUrl(null);
    try {
      const res = await fetch("/api/reconciliation/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          plant,
          mode,
          regenerate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generate failed.");
      setReport(json.report);
      setCachedNote(!!json.cached);
      setToast(
        json.cached
          ? "Loaded cached report for this period."
          : "Reconciliation report generated."
      );
      void loadTrend();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!report) return;
    try {
      const res = await fetch(
        `/api/reconciliation/export/${encodeURIComponent(report.reportId)}`,
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
      a.download = `reconciliation-${report.periodStart}-${report.periodEnd}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("PDF downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    }
  }

  function saveAndShare() {
    if (!report) return;
    const url = `${window.location.origin}/reconciliation?reportId=${encodeURIComponent(report.reportId)}`;
    setShareUrl(url);
    void navigator.clipboard?.writeText(url).then(
      () => setToast("Share link copied to clipboard."),
      () => setToast("Share link ready below.")
    );
  }

  const rows = useMemo(() => {
    if (!report) return [];
    let list = [...report.summary.byMaterial];
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    list.sort((a, b) => {
      if (sortKey === "status") {
        const order = { alert: 0, attention: 1, healthy: 2, unmapped: 3 };
        const av = order[a.status] ?? 9;
        const bv = order[b.status] ?? 9;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortKey === "materialCode" || sortKey === "materialGroup") {
        const av = a[sortKey];
        const bv = b[sortKey];
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      const av =
        sortKey === "varianceKg" ? Math.abs(a.varianceKg) : a[sortKey];
      const bv =
        sortKey === "varianceKg" ? Math.abs(b.varianceKg) : b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [report, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "varianceKg" ? "desc" : "asc");
    }
  }

  const pieData = useMemo(() => {
    if (!report) return [];
    return [
      { name: "Healthy", value: report.healthyCount, color: GREEN },
      { name: "Attention", value: report.attentionCount, color: AMBER },
      { name: "Alert", value: report.alertCount, color: RED },
    ].filter((d) => d.value > 0);
  }, [report]);

  const barData = useMemo(() => {
    if (!report) return [];
    return report.summary.byMaterialGroup.map((g) => ({
      group: g.materialGroup,
      expected: g.expectedKg,
      actual: g.actualKg,
    }));
  }, [report]);

  if (!canRead) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        You do not have access to reconciliation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} type="success" />
      )}

      <PageHeader
        title="Reconciliation"
        subtitle="Expected material from dispatches vs actual issues from the stock ledger."
        actions={
          <>
            <Link
              href="/reconciliation/history"
              className="text-sm font-semibold text-ps-navy"
            >
              History →
            </Link>
            {report && (
              <>
                <Button variant="secondary" onClick={() => void downloadPdf()}>
                  Download PDF
                </Button>
                <Button variant="secondary" onClick={saveAndShare}>
                  Save & Share
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
              Start
            </span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
              disabled={!canGenerate}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
              End
            </span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
              disabled={!canGenerate}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
              Plant
            </span>
            <select
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
              disabled={!canGenerate}
            >
              {DISPATCH_PLANTS.map((p) => (
                <option key={p} value={p}>
                  {p === "All" ? "All plants" : p}
                </option>
              ))}
            </select>
          </label>

          {canGenerate && (
            <>
              <Button onClick={() => void generate(false)} disabled={loading}>
                {loading ? "Generating…" : "Generate Report"}
              </Button>
              {report && (
                <Button
                  variant="secondary"
                  onClick={() => void generate(true)}
                  disabled={loading}
                >
                  Regenerate
                </Button>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["This Month", monthBounds(0)],
              ["Last Month", monthBounds(-1)],
              ["Last 30 Days", lastNDays(30)],
            ] as const
          ).map(([label, range]) => (
            <button
              key={label}
              type="button"
              disabled={!canGenerate}
              onClick={() => {
                setPeriodStart(range.start);
                setPeriodEnd(range.end);
              }}
              className="rounded-md border border-ps-gray-200 px-3 py-1.5 text-xs font-semibold text-ps-navy hover:bg-ps-gray-50 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs font-semibold uppercase text-ps-gray-500">
            Consumption Source
          </span>
          <span className="rounded-md bg-ps-navy px-3 py-1.5 text-xs font-semibold text-white">
            Auto (from parts master)
          </span>
          <span
            title="Coming soon"
            className="cursor-not-allowed rounded-md border border-ps-gray-200 px-3 py-1.5 text-xs font-semibold text-ps-gray-400"
          >
            Manual Upload{" "}
            <span className="ml-1 rounded bg-ps-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
              Soon
            </span>
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {shareUrl && (
        <div className="rounded border border-ps-gray-200 bg-ps-gray-50 px-4 py-3 text-sm text-ps-gray-700">
          Shareable link:{" "}
          <a href={shareUrl} className="break-all font-semibold text-ps-navy">
            {shareUrl}
          </a>
        </div>
      )}

      {loading && !report && (
        <p className="text-sm text-ps-gray-500">Loading report…</p>
      )}

      {!loading && !report && !error && (
        <div className="rounded-lg border border-dashed border-ps-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-serif text-lg text-ps-navy">No data</p>
          <p className="mt-2 text-sm text-ps-gray-500">
            {canGenerate
              ? "Pick a date range and generate a reconciliation report."
              : "Open a report from History to view details."}
          </p>
        </div>
      )}

      {report && (
        <>
          {cachedNote && (
            <p className="text-xs text-ps-gray-500">
              Showing cached report · {report.periodStart} → {report.periodEnd}
              {report.unmappedCount > 0
                ? ` · ${report.unmappedCount} unmapped dispatch items`
                : ""}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              label="Total Expected"
              value={fmtKg(report.totalExpectedKg)}
            />
            <KPICard
              label="Total Actual"
              value={fmtKg(report.totalActualKg)}
            />
            <KPICard
              label="Net Variance"
              value={`${report.totalVarianceKg >= 0 ? "+" : ""}${fmtKg(report.totalVarianceKg)}`}
              description={
                Math.abs(report.totalVariancePercent) < 5
                  ? "Healthy"
                  : Math.abs(report.totalVariancePercent) < 15
                    ? "Needs attention"
                    : "Alert"
              }
            />
            <KPICard
              label="Variance %"
              value={fmtPct(report.totalVariancePercent)}
              description={`${report.alertCount} alert · ${report.attentionCount} attention · ${report.healthyCount} healthy`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
              <h2 className="font-serif text-lg text-ps-navy">
                Expected vs Actual by Group
              </h2>
              {barData.length === 0 ? (
                <p className="mt-6 text-sm text-ps-gray-500">No group data.</p>
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="expected" name="Expected" fill={NAVY} />
                      <Bar dataKey="actual" name="Actual" fill={GREEN} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
              <h2 className="font-serif text-lg text-ps-navy">
                Status Distribution
              </h2>
              {pieData.length === 0 ? (
                <p className="mt-6 text-sm text-ps-gray-500">No status data.</p>
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {historyTrend.length > 1 && (
            <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
              <h2 className="font-serif text-lg text-ps-navy">
                Variance % Trend (recent reports)
              </h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="variancePercent"
                      name="Variance %"
                      stroke={NAVY}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg text-ps-navy">Materials</h2>
            <label className="text-sm">
              <span className="mr-2 text-xs font-semibold uppercase text-ps-gray-500">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="alert">Alert</option>
                <option value="attention">Attention</option>
                <option value="healthy">Healthy</option>
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-ps-gray-500">
              No materials match this filter.
            </p>
          ) : (
            <DataTable
              headers={[
                "Material",
                "Group",
                "Expected (kg)",
                "Actual (kg)",
                "Variance (kg)",
                "Variance %",
                "Status",
              ]}
            >
              {rows.map((row, i) => (
                <TableRow
                  key={row.materialCode}
                  index={i}
                  className="cursor-pointer"
                >
                  <Td>
                    <button
                      type="button"
                      className="text-left font-semibold text-ps-navy hover:underline"
                      onClick={() => setDrill(row)}
                    >
                      {row.materialCode}
                    </button>
                    <div className="text-xs text-ps-gray-500">
                      {row.materialName}
                    </div>
                  </Td>
                  <Td>{row.materialGroup}</Td>
                  <Td className="tabular-nums">{row.expectedKg.toFixed(1)}</Td>
                  <Td className="tabular-nums">{row.actualKg.toFixed(1)}</Td>
                  <Td
                    className={`tabular-nums font-semibold ${varianceColorClass(row.variancePercent)}`}
                  >
                    {row.varianceKg >= 0 ? "+" : ""}
                    {row.varianceKg.toFixed(1)}
                  </Td>
                  <Td
                    className={`tabular-nums font-semibold ${varianceColorClass(row.variancePercent)}`}
                  >
                    {fmtPct(row.variancePercent)}
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                </TableRow>
              ))}
            </DataTable>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-ps-gray-500">
            <span>Sort:</span>
            {(
              [
                ["varianceKg", "|Variance|"],
                ["variancePercent", "Variance %"],
                ["materialCode", "Material"],
                ["expectedKg", "Expected"],
                ["actualKg", "Actual"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`rounded px-2 py-1 ${
                  sortKey === key
                    ? "bg-ps-navy text-white"
                    : "bg-ps-gray-100 hover:bg-ps-gray-200"
                }`}
              >
                {label}
                {sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>

          {report.summary.unmappedItems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {report.summary.unmappedItems.length} unmapped dispatch items
                (not analyzed)
              </p>
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {report.summary.unmappedItems.slice(0, 20).map((u) => (
                  <li key={`${u.dispatchId}-${u.itemCode}`}>
                    {u.itemCode} × {u.quantity} — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {drill && (
        <DrillModal material={drill} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}

function DrillModal({
  material,
  onClose,
}: {
  material: MaterialVariance;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl text-ps-navy">
              {material.materialCode}
            </h3>
            <p className="text-sm text-ps-gray-500">
              {material.materialName} · {material.materialGroup}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-ps-gray-600 hover:bg-ps-gray-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <StatusBadge status={material.status} />
          <span>
            Expected <strong>{material.expectedKg.toFixed(1)} kg</strong>
          </span>
          <span>
            Actual <strong>{material.actualKg.toFixed(1)} kg</strong>
          </span>
          <span className={varianceColorClass(material.variancePercent)}>
            Variance{" "}
            <strong>
              {material.varianceKg >= 0 ? "+" : ""}
              {material.varianceKg.toFixed(1)} kg (
              {fmtPct(material.variancePercent)})
            </strong>
          </span>
        </div>

        <p className="mt-4 rounded-md bg-ps-gray-50 p-3 text-sm leading-relaxed text-ps-gray-700">
          {material.explanation}
        </p>

        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
          Dispatches contributing to expected
        </h4>
        {material.dispatches.length === 0 ? (
          <p className="mt-2 text-sm text-ps-gray-500">None</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ps-gray-50 text-xs uppercase text-ps-gray-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Scrap</th>
                  <th className="px-3 py-2">Expected kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ps-gray-100">
                {material.dispatches.map((d) => (
                  <tr key={`${d.dispatchId}-${d.itemCode}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{d.itemCode}</div>
                      <div className="text-xs text-ps-gray-500">
                        {d.itemDescription}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {d.quantity.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{d.weightGrams} g</td>
                    <td className="px-3 py-2 tabular-nums">{d.scrapPercent}%</td>
                    <td className="px-3 py-2 tabular-nums">
                      {d.expectedKg.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
          Stock movements contributing to actual
        </h4>
        {material.movements.length === 0 ? (
          <p className="mt-2 text-sm text-ps-gray-500">None</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ps-gray-50 text-xs uppercase text-ps-gray-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty kg</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ps-gray-100">
                {material.movements.map((m) => (
                  <tr key={m.movementId}>
                    <td className="px-3 py-2 text-xs">
                      {m.date.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2">{m.type}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {m.quantityKg.toFixed(1)}
                    </td>
                    <td className="px-3 py-2">{m.reason || "—"}</td>
                    <td className="px-3 py-2">
                      {m.referenceId ? (
                        <Link
                          href={`/accountant/po-list?q=${encodeURIComponent(m.referenceId)}`}
                          className="font-semibold text-ps-navy hover:underline"
                        >
                          {m.referenceId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
