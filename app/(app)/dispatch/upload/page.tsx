"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import { DISPATCH_PLANTS, type DispatchPlant } from "@/lib/types";
import type { ParsedDispatchItem } from "@/lib/dispatch-parser";

type Step = "select" | "preview" | "success";

function currentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export default function DispatchUploadPage() {
  const router = useRouter();
  const bounds = useMemo(() => currentMonthBounds(), []);
  const [file, setFile] = useState<File | null>(null);
  const [plant, setPlant] = useState<DispatchPlant>("All");
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<ParsedDispatchItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    plants: string[];
    shortfallCount: number;
    excessCount: number;
    onTrackCount: number;
    completeCount: number;
  } | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setItems([]);
    setSummary(null);
    setWarnings([]);
    setStep("select");
    setError(null);
  }, []);

  const parseFile = useCallback(
    async (selected: File, selectedPlant: DispatchPlant) => {
      setBusy(true);
      setError(null);
      try {
        const body = new FormData();
        body.append("file", selected);
        body.append("plant", selectedPlant);

        const res = await fetch("/api/dispatch/parse", {
          method: "POST",
          body,
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Parse failed.");

        const parsed: ParsedDispatchItem[] = Array.isArray(data.dispatches)
          ? data.dispatches
          : [];
        if (parsed.length === 0) {
          throw new Error(
            data.warnings?.[0] || "No dispatch rows found in the workbook."
          );
        }

        setFile(selected);
        setItems(parsed);
        setSummary(data.summary ?? null);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        if (data.inferredPeriod?.periodStart) {
          setPeriodStart(data.inferredPeriod.periodStart);
        }
        if (data.inferredPeriod?.periodEnd) {
          setPeriodEnd(data.inferredPeriod.periodEnd);
        }
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  function onFilePicked(selected: File | null) {
    if (!selected) return;
    void parseFile(selected, plant);
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("plant", plant);
      body.append("periodStart", periodStart);
      body.append("periodEnd", periodEnd);

      const res = await fetch("/api/dispatch/upload", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      setToast(
        `Uploaded ${data.summary?.total ?? 0} items · ${data.summary?.shortfallCount ?? 0} shortfalls`
      );
      setStep("success");
      router.push("/dispatch?uploaded=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} type="success" />
      )}

      <PageHeader
        title="Upload Dispatch Excel"
        subtitle="Schedule vs Despatch workbook — Plan vs Actual till Date across plants."
        actions={
          <Link href="/dispatch" className="text-sm font-semibold text-ps-navy">
            ← Back to list
          </Link>
        }
      />

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === "select" && (
        <div className="space-y-4 rounded-lg border border-ps-gray-200 bg-white p-6 shadow-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
                Period start
              </span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
                Period end
              </span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
                Plant
              </span>
              <select
                value={plant}
                onChange={(e) => setPlant(e.target.value as DispatchPlant)}
                className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
              >
                {DISPATCH_PLANTS.map((p) => (
                  <option key={p} value={p}>
                    {p === "All" ? "All (file contains all plants)" : p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFilePicked(f);
            }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 transition ${
              dragOver
                ? "border-ps-navy bg-ps-gray-50"
                : "border-ps-gray-300 bg-ps-gray-50/50"
            }`}
          >
            <p className="font-medium text-ps-navy">
              Drag & drop Schedule vs Despatch Excel
            </p>
            <p className="mt-1 text-sm text-ps-gray-500">
              .xlsx / .xls — Roorkee, Noida A-06, Noida A-07 bands
            </p>
            <label className="mt-4">
              <span className="inline-flex cursor-pointer items-center rounded-lg bg-ps-navy px-6 py-2.5 text-sm font-semibold text-white">
                {busy ? "Parsing…" : "Choose file"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={busy}
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      )}

      {step === "preview" && summary && (
        <div className="space-y-4">
          <div className="rounded-lg border border-ps-gray-200 bg-white p-5 shadow-card">
            <p className="text-sm text-ps-navy">
              <span className="font-semibold">{summary.total} items</span> detected
              across{" "}
              <span className="font-semibold">
                {summary.plants.length} plant
                {summary.plants.length === 1 ? "" : "s"}
              </span>
              {summary.plants.length > 0 && (
                <> ({summary.plants.join(", ")})</>
              )}
              ,{" "}
              <span className="font-semibold text-red-700">
                {summary.shortfallCount} shortfalls
              </span>{" "}
              flagged
              {file ? (
                <>
                  {" "}
                  · <span className="text-ps-gray-500">{file.name}</span>
                </>
              ) : null}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
                  Period start
                </span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
                  Period end
                </span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-ps-gray-500">
                  Plant scope
                </span>
                <select
                  value={plant}
                  onChange={(e) => {
                    const next = e.target.value as DispatchPlant;
                    setPlant(next);
                    if (file) void parseFile(file, next);
                  }}
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                >
                  {DISPATCH_PLANTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
                {warnings.slice(0, 5).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void handleConfirm()} disabled={busy}>
                {busy ? "Saving…" : "Confirm upload"}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>

          <DataTable
            headers={[
              "Plant",
              "Item Code",
              "Description",
              "Planned",
              "Actual",
              "Variance",
              "Status",
            ]}
          >
            {items.slice(0, 50).map((row, index) => (
              <TableRow
                key={`${row.plant}-${row.itemCode}-${index}`}
                index={index}
                className={
                  row.status === "shortfall"
                    ? "!bg-red-50"
                    : row.status === "excess"
                      ? "!bg-amber-50"
                      : ""
                }
              >
                <Td>{row.plant}</Td>
                <Td className="font-mono text-xs">{row.itemCode}</Td>
                <Td className="max-w-[240px] truncate">{row.itemDescription}</Td>
                <Td className="tabular-nums">{row.plannedQuantity}</Td>
                <Td className="tabular-nums">{row.actualQuantity}</Td>
                <Td className="tabular-nums">{row.variance}</Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
              </TableRow>
            ))}
          </DataTable>
          {items.length > 50 && (
            <p className="text-xs text-ps-gray-500">
              Showing first 50 of {items.length} rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
