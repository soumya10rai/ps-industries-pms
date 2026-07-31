"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Toast from "@/components/Toast";
import {
  INVENTORY_PLANTS,
  MATERIAL_TYPE_LABELS,
  formatINR,
  type InventoryPlant,
  type MaterialType,
  type RawMaterial,
  type StockMovement,
} from "@/lib/types";

export default function InventoryPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [plant, setPlant] = useState("");
  const [group, setGroup] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType | "">("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<RawMaterial | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState<{
    materialCode: string;
    quantityKg: string;
    plant: InventoryPlant;
    notes: string;
  }>({
    materialCode: "",
    quantityKg: "",
    plant: INVENTORY_PLANTS[0],
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (plant) params.set("plant", plant);
      if (lowStockOnly) params.set("lowStock", "true");
      const res = await fetch(`/api/inventory/list?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inventory.");
      setMaterials(Array.isArray(data.materials) ? data.materials : []);
      setTotalStockValue(Number(data.totalStockValue ?? 0));
      setLowStockCount(Number(data.lowStockCount ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [plant, lowStockOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const set = new Set(materials.map((m) => m.materialGroup).filter(Boolean));
    return Array.from(set).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (group && m.materialGroup !== group) return false;
      if (materialType && m.materialType !== materialType) return false;
      if (!q) return true;
      return (
        m.materialCode.toLowerCase().includes(q) ||
        m.materialName.toLowerCase().includes(q) ||
        m.materialGroup.toLowerCase().includes(q) ||
        (m.partyName ?? "").toLowerCase().includes(q)
      );
    });
  }, [materials, search, group, materialType]);

  async function openHistory(item: RawMaterial) {
    setHistoryFor(item);
    setHistoryLoading(true);
    setMovements([]);
    try {
      const res = await fetch(
        `/api/inventory/movements?materialCode=${encodeURIComponent(item.materialCode)}&limit=30`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load movements.");
      setMovements(Array.isArray(data.movements) ? data.movements : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/receive", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialCode: receiveForm.materialCode,
          quantityKg: Number(receiveForm.quantityKg),
          plant: receiveForm.plant,
          notes: receiveForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Receive failed.");
      setReceiveOpen(false);
      setReceiveForm({
        materialCode: "",
        quantityKg: "",
        plant: INVENTORY_PLANTS[0],
        notes: "",
      });
      setToast(
        `Received ${receiveForm.quantityKg} kg of ${String(receiveForm.materialCode).toUpperCase()}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title="Inventory"
        subtitle="Raw material stock across Noida and Roorkee — live from Firestore."
        actions={
          <>
            <select
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              className="rounded-lg border border-ps-gray-200 bg-white px-3 py-2 text-sm text-ps-navy"
              aria-label="Filter by plant"
            >
              <option value="">All plants</option>
              {INVENTORY_PLANTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => setReceiveOpen(true)}>
              Manual Receive
            </Button>
            <Link href="/store/inventory/upload">
              <Button>Upload Excel</Button>
            </Link>
          </>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard
          label="Total Materials"
          value={loading ? "—" : materials.length}
          description="Active raw materials"
        />
        <KPICard
          label="Low Stock"
          value={loading ? "—" : lowStockCount}
          description="Below reorder level"
        />
        <KPICard
          label="Stock Value"
          value={loading ? "—" : formatINR(totalStockValue)}
          description="kg × rate"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code or name…"
          className="min-w-[200px] flex-1 rounded-lg border border-ps-gray-200 px-3 py-2 text-sm"
        />
        <select
          value={materialType}
          onChange={(e) =>
            setMaterialType(e.target.value as MaterialType | "")
          }
          className="rounded-lg border border-ps-gray-200 bg-white px-3 py-2 text-sm"
          aria-label="Filter by material type"
        >
          <option value="">All types</option>
          <option value="raw_material">
            {MATERIAL_TYPE_LABELS.raw_material}
          </option>
          <option value="masterbatch">
            {MATERIAL_TYPE_LABELS.masterbatch}
          </option>
        </select>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="rounded-lg border border-ps-gray-200 bg-white px-3 py-2 text-sm"
          aria-label="Filter by material group"
        >
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ps-gray-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading inventory…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-navy/30 bg-white px-6 py-16 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">No materials found</p>
          <p className="mt-3 text-sm text-ps-gray-500">
            Upload an RM Excel file to seed stock, or receive materials manually.
          </p>
          <div className="mt-6">
            <Link href="/store/inventory/upload">
              <Button>Upload Excel</Button>
            </Link>
          </div>
        </div>
      ) : (
        <DataTable
          headers={[
            "Material Code",
            "Material Name",
            "Group",
            "Type",
            "Current Stock (kg)",
            "Reorder Level",
            "Location",
            "Last Updated",
            "Actions",
          ]}
        >
          {filtered.map((item, i) => {
            const isLow = item.currentStockKg < item.reorderLevelKg;
            return (
              <TableRow
                key={item.materialCode}
                index={i}
                className={isLow ? "!bg-red-50" : undefined}
              >
                <Td className="font-semibold text-ps-navy">
                  <Link
                    href={`/store/inventory/${encodeURIComponent(item.materialCode)}`}
                    className="hover:underline"
                  >
                    {item.materialCode}
                  </Link>
                </Td>
                <Td>
                  <div>{item.materialName}</div>
                  {item.partyName && (
                    <div className="text-xs text-ps-gray-400">
                      {item.partyName}
                    </div>
                  )}
                </Td>
                <Td>{item.materialGroup || "—"}</Td>
                <Td className="text-xs">
                  {MATERIAL_TYPE_LABELS[item.materialType]}
                </Td>
                <Td className={isLow ? "font-semibold text-ps-red" : ""}>
                  {item.currentStockKg.toLocaleString("en-IN")}
                </Td>
                <Td>{item.reorderLevelKg.toLocaleString("en-IN")}</Td>
                <Td>{item.location || "—"}</Td>
                <Td>
                  {item.lastUpdatedAt
                    ? new Date(item.lastUpdatedAt).toLocaleString("en-IN")
                    : "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-ps-navy hover:underline"
                      onClick={() => void openHistory(item)}
                    >
                      View History
                    </button>
                    <Link
                      href={`/store/inventory/${encodeURIComponent(item.materialCode)}`}
                      className="text-xs font-semibold text-ps-navy hover:underline"
                    >
                      Detail
                    </Link>
                  </div>
                </Td>
              </TableRow>
            );
          })}
        </DataTable>
      )}

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-ps-h2 text-ps-navy">
                  Movement History
                </h2>
                <p className="text-sm text-ps-gray-500">
                  {historyFor.materialCode} · {historyFor.materialName}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setHistoryFor(null)}>
                Close
              </Button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-ps-gray-500">Loading…</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-ps-gray-500">No movements yet.</p>
            ) : (
              <DataTable
                headers={["Date", "Type", "Qty", "Balance", "Reason", "Ref"]}
              >
                {movements.map((m, i) => (
                  <TableRow key={m.movementId} index={i}>
                    <Td>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString("en-IN")
                        : "—"}
                    </Td>
                    <Td className="capitalize">{m.type.replace("_", " ")}</Td>
                    <Td
                      className={
                        m.quantityKg < 0 ? "text-ps-red" : "text-emerald-700"
                      }
                    >
                      {m.quantityKg > 0 ? "+" : ""}
                      {m.quantityKg.toLocaleString("en-IN")}
                    </Td>
                    <Td>{m.balanceAfterKg.toLocaleString("en-IN")}</Td>
                    <Td>{m.reason}</Td>
                    <Td>{m.referenceId || "—"}</Td>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      )}

      {receiveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e) => void handleReceive(e)}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-card"
          >
            <h2 className="font-serif text-ps-h2 text-ps-navy">
              Manual Receive
            </h2>
            <p className="mt-1 text-sm text-ps-gray-500">
              Add stock from a supplier receipt.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Material Code</span>
                <input
                  required
                  value={receiveForm.materialCode}
                  onChange={(e) =>
                    setReceiveForm((f) => ({
                      ...f,
                      materialCode: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                  placeholder="PPCP-B120"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Quantity (kg)</span>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  value={receiveForm.quantityKg}
                  onChange={(e) =>
                    setReceiveForm((f) => ({
                      ...f,
                      quantityKg: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Plant</span>
                <select
                  value={receiveForm.plant}
                  onChange={(e) =>
                    setReceiveForm((f) => ({
                      ...f,
                      plant: e.target.value as InventoryPlant,
                    }))
                  }
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                >
                  {INVENTORY_PLANTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Notes</span>
                <textarea
                  value={receiveForm.notes}
                  onChange={(e) =>
                    setReceiveForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                  rows={2}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setReceiveOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Receive Stock"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
