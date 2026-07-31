"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import KPICard from "@/components/KPICard";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Toast from "@/components/Toast";
import {
  INVENTORY_PLANTS,
  MATERIAL_TYPE_LABELS,
  type InventoryPlant,
  type RawMaterial,
  type StockMovement,
} from "@/lib/types";

export default function MaterialDetailPage() {
  const params = useParams();
  const materialCode = decodeURIComponent(
    String(params?.materialCode || "")
  ).toUpperCase();

  const [material, setMaterial] = useState<RawMaterial | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"receive" | "issue" | null>(null);
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [plant, setPlant] = useState<InventoryPlant>(INVENTORY_PLANTS[0]);

  const load = useCallback(async () => {
    if (!materialCode) return;
    setLoading(true);
    setError(null);
    try {
      const [matRes, movRes] = await Promise.all([
        fetch(`/api/inventory/${encodeURIComponent(materialCode)}`, {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch(
          `/api/inventory/movements?materialCode=${encodeURIComponent(materialCode)}&limit=100`,
          { credentials: "same-origin", cache: "no-store" }
        ),
      ]);
      const matData = await matRes.json();
      const movData = await movRes.json();
      if (!matRes.ok) throw new Error(matData.error || "Material not found.");
      setMaterial(matData.material);
      if (matData.material?.location) {
        const loc = matData.material.location as string;
        if ((INVENTORY_PLANTS as readonly string[]).includes(loc)) {
          setPlant(loc as InventoryPlant);
        }
      }
      setMovements(Array.isArray(movData.movements) ? movData.movements : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load material.");
      setMaterial(null);
    } finally {
      setLoading(false);
    }
  }, [materialCode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitModal(e: FormEvent) {
    e.preventDefault();
    if (!material) return;
    setBusy(true);
    setError(null);

    try {
      if (modal === "receive") {
        const res = await fetch("/api/inventory/receive", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialCode: material.materialCode,
            quantityKg: Number(qty),
            plant,
            notes: notes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Receive failed.");
        setToast(`Received ${qty} kg`);
      } else if (modal === "issue") {
        const res = await fetch("/api/inventory/issue", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialCode: material.materialCode,
            quantityKg: Number(qty),
            reason: reason || "Manual Issue",
            plant,
            notes: notes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Issue failed.");
        setToast(`Issued ${qty} kg`);
      }

      setModal(null);
      setQty("");
      setNotes("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const isLow =
    material != null && material.currentStockKg < material.reorderLevelKg;

  return (
    <div className="ps-section">
      <PageHeader
        title={material?.materialCode || materialCode || "Material"}
        subtitle={
          material
            ? [
                material.materialName,
                material.materialGroup,
                MATERIAL_TYPE_LABELS[material.materialType],
                material.partyName,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Raw material detail and movement ledger"
        }
        actions={
          <>
            <Link href="/store/inventory">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button
              variant="secondary"
              disabled={!material}
              onClick={() => setModal("receive")}
            >
              Receive Stock
            </Button>
            <Button disabled={!material} onClick={() => setModal("issue")}>
              Issue Stock
            </Button>
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

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading…</p>
      ) : !material ? (
        <div className="rounded-lg border border-dashed border-ps-navy/30 bg-white px-6 py-16 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">Material not found</p>
          <Link href="/store/inventory" className="mt-4 inline-block">
            <Button>Back to Inventory</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KPICard
              label="Current Stock"
              value={`${material.currentStockKg.toLocaleString("en-IN")} kg`}
              description={isLow ? "Below reorder level" : "On hand"}
            />
            <KPICard
              label="Reorder Level"
              value={`${material.reorderLevelKg.toLocaleString("en-IN")} kg`}
              description={material.location || "—"}
            />
            <KPICard
              label="Last Updated"
              value={
                material.lastUpdatedAt
                  ? new Date(material.lastUpdatedAt).toLocaleDateString("en-IN")
                  : "—"
              }
              description={
                material.ratePerKg
                  ? `₹${material.ratePerKg.toLocaleString("en-IN")}/kg`
                  : "No rate set"
              }
            />
          </div>

          <div>
            <h2 className="mb-3 font-serif text-ps-h2 text-ps-navy">
              Movement History
            </h2>
            {movements.length === 0 ? (
              <p className="text-sm text-ps-gray-500">No movements yet.</p>
            ) : (
              <DataTable
                headers={[
                  "Date",
                  "Type",
                  "Qty",
                  "Balance",
                  "Reason",
                  "Ref",
                  "User",
                ]}
              >
                {movements.map((m, i) => (
                  <TableRow key={m.movementId} index={i}>
                    <Td>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString("en-IN")
                        : "—"}
                    </Td>
                    <Td className="capitalize">
                      {m.type.replace("_", " ")}
                    </Td>
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
                    <Td className="max-w-[120px] truncate text-xs">
                      {m.createdBy || "—"}
                    </Td>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </div>
        </>
      )}

      {modal && material && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e) => void submitModal(e)}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-card"
          >
            <h2 className="font-serif text-ps-h2 text-ps-navy">
              {modal === "receive" ? "Receive Stock" : "Issue Stock"}
            </h2>
            <p className="mt-1 text-sm text-ps-gray-500">
              {material.materialCode} · available{" "}
              {material.currentStockKg.toLocaleString("en-IN")} kg
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Quantity (kg)</span>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Plant</span>
                <select
                  value={plant}
                  onChange={(e) =>
                    setPlant(e.target.value as InventoryPlant)
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
              {modal === "issue" && (
                <label className="block text-sm">
                  <span className="mb-1 block text-ps-gray-600">Reason</span>
                  <input
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-ps-gray-200 px-3 py-2"
                    placeholder="Manual issue / production"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-ps-gray-600">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
