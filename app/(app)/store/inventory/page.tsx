"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import FileUploadZone from "@/components/FileUploadZone";
import Button from "@/components/Button";
import Toast from "@/components/Toast";
import {
  exportToFirestore,
  formatFileSize,
  type ParsedMaterial,
  type RawMaterialRecord,
} from "@/lib/excel-parser";

type ToastState = { message: string; type: "success" | "error" } | null;

function formatUpdated(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryPage() {
  const [stock, setStock] = useState<RawMaterialRecord[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [filter, setFilter] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMaterial[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const res = await fetch("/api/inventory/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load inventory.");
      }
      setStock((data.materials ?? []) as RawMaterialRecord[]);
    } catch (err) {
      console.error("[inventory] loadStock", err);
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to load inventory.",
        type: "error",
      });
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    void loadStock();
  }, [loadStock]);

  const handleFileSelected = useCallback(async (selected: File) => {
    setFile(selected);
    setSelectedAt(new Date().toISOString());
    setParsed([]);
    setParseError(null);
    setParsing(true);

    try {
      const materials = await exportToFirestore(selected);
      setParsed(materials);
    } catch (err) {
      console.error("[inventory] parse", err);
      const message =
        err instanceof Error ? err.message : "Failed to parse Excel file.";
      setParseError(message);
      setToast({ message, type: "error" });
    } finally {
      setParsing(false);
    }
  }, []);

  async function handleConfirmSave() {
    if (parsed.length === 0) return;
    setSaving(true);
    setParseError(null);

    try {
      const res = await fetch("/api/inventory/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materials: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save inventory.");
      }

      const count = Number(data.saved ?? parsed.length);
      setToast({
        message: `${count} materials uploaded successfully`,
        type: "success",
      });
      setFile(null);
      setSelectedAt(null);
      setParsed([]);
      await loadStock();
    } catch (err) {
      console.error("[inventory] save", err);
      const message =
        err instanceof Error ? err.message : "Failed to save inventory.";
      setToast({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((row) =>
      row.material_name.toLowerCase().includes(q)
    );
  }, [filter, stock]);

  const lowStockCount = stock.filter(
    (row) => row.current_qty <= row.reorder_level
  ).length;

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <PageHeader
        title="Inventory"
        subtitle="Upload Excel stock sheets and sync raw materials to Firestore for Greater Noida Plant."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KPICard
          label="Total Materials"
          value={loadingStock ? "…" : stock.length}
          description="In raw_materials"
        />
        <KPICard
          label="Low Stock"
          value={loadingStock ? "…" : lowStockCount}
          description="At or below reorder level"
        />
        <KPICard
          label="Pending Upload"
          value={parsed.length}
          description={file ? file.name : "No file selected"}
        />
      </div>

      <section className="mb-8 space-y-4">
        <h2 className="font-serif text-xl font-bold text-ps-navy">
          Excel Upload
        </h2>

        <FileUploadZone
          disabled={parsing || saving}
          onFileSelected={(f) => void handleFileSelected(f)}
          onInvalidFile={(message) => {
            setParseError(message);
            setToast({ message, type: "error" });
          }}
        />

        {file && (
          <div className="rounded-lg border border-ps-gray-200 bg-white p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
              File preview
            </p>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ps-gray-500">Name</dt>
                <dd className="font-medium text-ps-navy">{file.name}</dd>
              </div>
              <div>
                <dt className="text-ps-gray-500">Size</dt>
                <dd className="font-medium">{formatFileSize(file.size)}</dd>
              </div>
              <div>
                <dt className="text-ps-gray-500">Selected</dt>
                <dd className="font-medium">
                  {selectedAt ? formatUpdated(selectedAt) : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {parsing && (
          <p className="text-sm text-ps-gray-500" role="status">
            Parsing Excel file…
          </p>
        )}

        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800" role="alert">
            {parseError}
          </div>
        )}

        {parsed.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-ps-navy">
                {parsed.length} materials detected
              </p>
              <Button
                type="button"
                onClick={() => void handleConfirmSave()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Confirm"}
              </Button>
            </div>

            <DataTable
              headers={[
                "Material Name",
                "Quantity",
                "Location",
                "Reorder Level",
              ]}
            >
              {parsed.map((row, i) => (
                <TableRow key={`${row.material_name}-${i}`} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {row.material_name}
                  </Td>
                  <Td>{row.current_qty.toLocaleString("en-IN")}</Td>
                  <Td>{row.location}</Td>
                  <Td>{row.reorder_level.toLocaleString("en-IN")}</Td>
                </TableRow>
              ))}
            </DataTable>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-xl font-bold text-ps-navy">
            Current Stock
          </h2>
          <div className="w-full sm:max-w-xs">
            <label
              htmlFor="material-filter"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-ps-gray-500"
            >
              Filter by material
            </label>
            <input
              id="material-filter"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search material name…"
              className="w-full rounded-md border border-ps-gray-300 px-3 py-2 text-sm outline-none focus:border-ps-navy focus:ring-2 focus:ring-ps-navy/20"
            />
          </div>
        </div>

        {loadingStock ? (
          <p className="text-sm text-ps-gray-500" role="status">
            Loading stock from Firestore…
          </p>
        ) : (
          <DataTable
            headers={[
              "Material",
              "Qty",
              "Location",
              "Reorder Level",
              "Updated",
            ]}
          >
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-ps-gray-500"
                >
                  {stock.length === 0
                    ? "No materials"
                    : "No materials match your filter."}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => {
                const isLow = row.current_qty <= row.reorder_level;
                return (
                  <TableRow key={row.id} index={i}>
                    <Td className="font-semibold text-ps-navy">
                      {row.material_name}
                    </Td>
                    <Td className={isLow ? "font-semibold text-ps-red" : ""}>
                      {row.current_qty.toLocaleString("en-IN")}
                    </Td>
                    <Td>{row.location}</Td>
                    <Td>{row.reorder_level.toLocaleString("en-IN")}</Td>
                    <Td>{formatUpdated(row.last_updated)}</Td>
                  </TableRow>
                );
              })
            )}
          </DataTable>
        )}
      </section>
    </div>
  );
}
