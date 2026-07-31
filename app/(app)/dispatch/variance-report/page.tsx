"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import { DISPATCH_PLANTS, type DispatchItem } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

interface VariancePayload {
  totalPlanned: number;
  totalDispatched: number;
  totalVariance: number;
  totalVariancePercent: number;
  byPlant: Array<{
    plant: string;
    planned: number;
    dispatched: number;
    variance: number;
  }>;
  byCustomer: Array<{
    customer: string;
    planned: number;
    dispatched: number;
    variance: number;
    shortfallCount: number;
  }>;
  shortfalls: DispatchItem[];
  statusCounts: {
    complete: number;
    on_track: number;
    shortfall: number;
    excess: number;
  };
  periodStart?: string;
  periodEnd?: string;
  history?: Array<{
    uploadId: string;
    periodStart: string;
    periodEnd: string;
    totalItems: number;
    isLatest: boolean;
  }>;
}

export default function DispatchVarianceReportPage() {
  const { role } = useAuth();
  const canPdf =
    role === "admin" || role === "plant_head" || role === "accountant";

  const [plant, setPlant] = useState("");
  const [data, setData] = useState<VariancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (plant) params.set("plant", plant);
      const res = await fetch(`/api/dispatch/variance?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load report.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [plant]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusTotal = useMemo(() => {
    if (!data) return 1;
    const s = data.statusCounts;
    return Math.max(
      1,
      s.complete + s.on_track + s.shortfall + s.excess
    );
  }, [data]);

  async function downloadPdf() {
    try {
      const params = new URLSearchParams();
      if (plant) params.set("plant", plant);
      const res = await fetch(`/api/dispatch/pdf?${params}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "PDF export failed.");
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
        title="Dispatch Variance Report"
        subtitle={
          data?.periodStart
            ? `${data.periodStart} → ${data.periodEnd}`
            : "Plan vs actual reconciliation"
        }
        actions={
          <>
            <Link href="/dispatch" className="text-sm font-semibold text-ps-navy">
              ← Dispatch list
            </Link>
            {canPdf && (
              <Button onClick={() => void downloadPdf()}>Export as PDF</Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
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
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading || !data ? (
        <p className="text-sm text-ps-gray-500">
          {loading ? "Loading report…" : "No data."}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard label="Total Planned" value={fmt(data.totalPlanned)} />
            <KPICard
              label="Total Dispatched"
              value={fmt(data.totalDispatched)}
            />
            <KPICard
              label="Variance"
              value={`${data.totalVariance >= 0 ? "+" : ""}${fmt(data.totalVariance)}`}
              description={`${data.totalVariancePercent >= 0 ? "+" : ""}${data.totalVariancePercent.toFixed(1)}%`}
            />
            <KPICard
              label="Shortfalls"
              value={data.statusCounts.shortfall}
              description={`${data.statusCounts.excess} excess · ${data.statusCounts.on_track} on track`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
              <h2 className="font-serif text-lg text-ps-navy">Status mix</h2>
              <div className="mt-4 flex h-4 overflow-hidden rounded">
                <Seg
                  color="bg-emerald-600"
                  flex={data.statusCounts.complete / statusTotal}
                  title="Complete"
                />
                <Seg
                  color="bg-emerald-400"
                  flex={data.statusCounts.on_track / statusTotal}
                  title="On track"
                />
                <Seg
                  color="bg-red-500"
                  flex={data.statusCounts.shortfall / statusTotal}
                  title="Shortfall"
                />
                <Seg
                  color="bg-amber-500"
                  flex={data.statusCounts.excess / statusTotal}
                  title="Excess"
                />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ps-gray-600">
                <li>Complete — {data.statusCounts.complete}</li>
                <li>On track — {data.statusCounts.on_track}</li>
                <li>Shortfall — {data.statusCounts.shortfall}</li>
                <li>Excess — {data.statusCounts.excess}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
              <h2 className="font-serif text-lg text-ps-navy">
                Uploads over time
              </h2>
              {(data.history?.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-ps-gray-500">
                  Upload more periods to see trend.
                </p>
              ) : (
                <div className="mt-4 flex h-32 items-end gap-2">
                  {data.history!.map((h) => {
                    const max = Math.max(
                      ...data.history!.map((x) => x.totalItems),
                      1
                    );
                    const height = Math.max(8, (h.totalItems / max) * 100);
                    return (
                      <div
                        key={h.uploadId}
                        className="flex flex-1 flex-col items-center gap-1"
                        title={`${h.periodStart} · ${h.totalItems} items`}
                      >
                        <div
                          className={`w-full rounded-t ${
                            h.isLatest ? "bg-ps-navy" : "bg-ps-navy/40"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="truncate text-[10px] text-ps-gray-500">
                          {h.periodStart.slice(0, 7)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-lg text-ps-navy">By plant</h2>
            <DataTable
              headers={["Plant", "Planned", "Dispatched", "Variance"]}
            >
              {data.byPlant.map((r, i) => (
                <TableRow key={r.plant} index={i}>
                  <Td>{r.plant}</Td>
                  <Td className="tabular-nums">{fmt(r.planned)}</Td>
                  <Td className="tabular-nums">{fmt(r.dispatched)}</Td>
                  <Td
                    className={`tabular-nums font-semibold ${
                      r.variance < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {fmt(r.variance)}
                  </Td>
                </TableRow>
              ))}
            </DataTable>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-lg text-ps-navy">By customer</h2>
            <DataTable
              headers={[
                "Customer",
                "Planned",
                "Dispatched",
                "Variance",
                "Shortfalls",
              ]}
            >
              {data.byCustomer.map((r, i) => (
                <TableRow key={r.customer} index={i}>
                  <Td>{r.customer}</Td>
                  <Td className="tabular-nums">{fmt(r.planned)}</Td>
                  <Td className="tabular-nums">{fmt(r.dispatched)}</Td>
                  <Td
                    className={`tabular-nums font-semibold ${
                      r.variance < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {fmt(r.variance)}
                  </Td>
                  <Td className="tabular-nums">{r.shortfallCount}</Td>
                </TableRow>
              ))}
            </DataTable>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-lg text-ps-navy">
              Top 10 largest shortfalls
            </h2>
            {data.shortfalls.length === 0 ? (
              <p className="text-sm text-ps-gray-500">No shortfalls.</p>
            ) : (
              <DataTable
                headers={[
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
                {data.shortfalls.map((r, i) => (
                  <TableRow
                    key={r.dispatchId}
                    index={i}
                    className="!bg-red-50"
                  >
                    <Td className="font-mono text-xs">{r.itemCode}</Td>
                    <Td className="max-w-[220px] truncate">
                      {r.itemDescription}
                    </Td>
                    <Td>{r.plant}</Td>
                    <Td className="tabular-nums">{fmt(r.plannedQuantity)}</Td>
                    <Td className="tabular-nums">{fmt(r.actualQuantity)}</Td>
                    <Td className="tabular-nums font-semibold text-red-700">
                      {fmt(r.variance)}
                    </Td>
                    <Td className="tabular-nums">
                      {r.variancePercent.toFixed(1)}%
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Seg({
  color,
  flex,
  title,
}: {
  color: string;
  flex: number;
  title: string;
}) {
  if (flex <= 0) return null;
  return (
    <div
      className={`${color}`}
      style={{ flex }}
      title={title}
    />
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
