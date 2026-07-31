"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Toast from "@/components/Toast";
import {
  INVENTORY_PLANTS,
  MATERIAL_TYPE_LABELS,
  type InventoryPlant,
} from "@/lib/types";
import type {
  ParsedInventoryRow,
  ParsedSheetSummary,
} from "@/lib/inventory-parser";

type Step = "select" | "preview" | "success";

export default function InventoryUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [plant, setPlant] = useState<InventoryPlant>(INVENTORY_PLANTS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<ParsedInventoryRow[]>([]);
  const [sheets, setSheets] = useState<ParsedSheetSummary[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("select");
  const [toast, setToast] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    added: number;
    updated: number;
    total: number;
    uploadId: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setItems([]);
    setSheets([]);
    setSelectedSheets([]);
    setWarnings([]);
    setSummary(null);
    setStep("select");
    setError(null);
  }, []);

  const parseFile = useCallback(
    async (selected: File, sheetNames: string[] = []) => {
      setBusy(true);
      setError(null);

      try {
        const body = new FormData();
        body.append("file", selected);
        for (const name of sheetNames) body.append("sheets", name);

        const res = await fetch("/api/inventory/parse", {
          method: "POST",
          body,
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Parse failed.");

        const parsed: ParsedInventoryRow[] = Array.isArray(data.items)
          ? data.items
          : [];
        const detected: ParsedSheetSummary[] = Array.isArray(data.sheets)
          ? data.sheets
          : [];

        if (detected.length === 0) {
          throw new Error(
            data.warnings?.[0] || "No stock sheets found in the workbook."
          );
        }

        setFile(selected);
        setItems(parsed);
        setSheets(detected);
        setSelectedSheets(
          detected.filter((s) => s.selected).map((s) => s.sheetName)
        );
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  function toggleSheet(sheetName: string) {
    const next = selectedSheets.includes(sheetName)
      ? selectedSheets.filter((s) => s !== sheetName)
      : [...selectedSheets, sheetName];
    setSelectedSheets(next);
    if (file && next.length > 0) void parseFile(file, next);
  }

  async function handleConfirm() {
    if (!file || selectedSheets.length === 0) return;
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("plant", plant);
      for (const name of selectedSheets) body.append("sheets", name);

      const res = await fetch("/api/inventory/upload", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      setSummary({
        added: data.summary?.added ?? 0,
        updated: data.summary?.updated ?? 0,
        total: data.summary?.total ?? items.length,
        uploadId: data.uploadId,
      });
      setWarnings(data.summary?.warnings ?? warnings);
      setStep("success");
      setToast("Inventory upload complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void parseFile(dropped);
  }

  function onFileInput(e: FormEvent<HTMLInputElement>) {
    const selected = e.currentTarget.files?.[0];
    if (selected) void parseFile(selected);
  }

  const countsByType = useMemo(() => {
    const chosen = sheets.filter((s) => selectedSheets.includes(s.sheetName));
    return {
      raw: chosen
        .filter((s) => s.materialType === "raw_material")
        .reduce((n, s) => n + s.count, 0),
      mb: chosen
        .filter((s) => s.materialType === "masterbatch")
        .reduce((n, s) => n + s.count, 0),
    };
  }, [sheets, selectedSheets]);

  return (
    <div className="ps-section">
      <PageHeader
        title="Upload Inventory Excel"
        subtitle="Import RM stock sheets. Monthly history sheets are detected automatically — the latest raw material and masterbatch sheets are pre-selected."
        actions={
          <Link href="/store/inventory">
            <Button variant="secondary">Back to Inventory</Button>
          </Link>
        }
      />

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {step === "select" && (
        <div className="space-y-6">
          <label className="block max-w-sm text-sm">
            <span className="mb-1 block font-semibold text-ps-navy">
              Plant (required)
            </span>
            <select
              value={plant}
              onChange={(e) => setPlant(e.target.value as InventoryPlant)}
              className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
            >
              {INVENTORY_PLANTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed bg-white px-6 py-16 text-center shadow-card transition ${
              dragOver ? "border-ps-navy bg-ps-gray-50" : "border-ps-navy/30"
            }`}
          >
            <p className="font-serif text-ps-h2 text-ps-navy">
              Drop RM Excel here
            </p>
            <p className="mt-2 text-sm text-ps-gray-500">
              Accepts .xlsx / .xls — e.g. RM_01-06-26.xlsx
            </p>
            <label className="mt-6 inline-flex cursor-pointer">
              <span className="rounded-lg bg-ps-navy px-6 py-2.5 text-sm font-semibold text-white shadow-btn">
                {busy ? "Parsing…" : "Choose file"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                disabled={busy}
                onChange={onFileInput}
              />
            </label>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <div className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 shadow-card">
            <p className="font-serif text-ps-h2 text-ps-navy">
              {items.length} materials detected
            </p>
            <p className="mt-1 text-sm text-ps-gray-600">
              {countsByType.raw} raw material
              {countsByType.raw === 1 ? "" : "s"} · {countsByType.mb}{" "}
              masterbatch
              {countsByType.mb === 1 ? "" : "es"}
            </p>
            <p className="mt-1 text-sm text-ps-gray-500">
              File: {file?.name} · Plant: {plant}
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-serif text-ps-h2 text-ps-navy">
              Sheets to import
            </h2>
            <p className="mb-3 text-sm text-ps-gray-500">
              This workbook keeps one sheet per month. Only the selected sheets
              are written to stock.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sheets.map((sheet) => (
                <label
                  key={sheet.sheetName}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    selectedSheets.includes(sheet.sheetName)
                      ? "border-ps-navy bg-ps-gray-50"
                      : "border-ps-gray-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSheets.includes(sheet.sheetName)}
                    disabled={busy}
                    onChange={() => toggleSheet(sheet.sheetName)}
                  />
                  <span className="flex-1">
                    <span className="font-semibold text-ps-navy">
                      {sheet.sheetName}
                    </span>
                    <span className="block text-xs text-ps-gray-500">
                      {MATERIAL_TYPE_LABELS[sheet.materialType]}
                      {sheet.period ? ` · ${sheet.period}` : ""} ·{" "}
                      {sheet.count} items
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Warnings ({warnings.length})</p>
              <ul className="mt-1 list-disc pl-5">
                {warnings.slice(0, 8).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {warnings.length > 8 && (
                  <li>…and {warnings.length - 8} more</li>
                )}
              </ul>
            </div>
          )}

          <DataTable
            headers={[
              "Code",
              "Name",
              "Group",
              "Type",
              "Party",
              "Opening",
              "Current",
              "Reorder",
            ]}
          >
            {items.slice(0, 100).map((row, i) => (
              <TableRow key={`${row.sheetName}-${row.materialCode}`} index={i}>
                <Td className="font-semibold text-ps-navy">
                  {row.materialCode}
                </Td>
                <Td>{row.materialName}</Td>
                <Td>{row.materialGroup}</Td>
                <Td className="text-xs">
                  {MATERIAL_TYPE_LABELS[row.materialType]}
                </Td>
                <Td>{row.partyName || "—"}</Td>
                <Td>{row.openingStockKg.toLocaleString("en-IN")}</Td>
                <Td className="font-semibold">
                  {row.currentStockKg.toLocaleString("en-IN")}
                </Td>
                <Td>{row.reorderLevelKg.toLocaleString("en-IN")}</Td>
              </TableRow>
            ))}
          </DataTable>
          {items.length > 100 && (
            <p className="text-xs text-ps-gray-500">
              Showing first 100 of {items.length} rows.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
            <Button
              disabled={busy || selectedSheets.length === 0}
              onClick={() => void handleConfirm()}
            >
              {busy ? "Uploading…" : `Confirm Upload (${items.length})`}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && summary && (
        <div className="rounded-lg border border-emerald-200 bg-white px-6 py-12 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">Upload complete</p>
          <p className="mt-3 text-sm text-ps-gray-600">
            {summary.total} materials: <strong>{summary.added} new</strong>,{" "}
            <strong>{summary.updated} updates</strong>
          </p>
          <p className="mt-1 text-xs text-ps-gray-400">
            Upload ID: {summary.uploadId}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/store/inventory">
              <Button>View Inventory</Button>
            </Link>
            <Button variant="secondary" onClick={reset}>
              Upload another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
