"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import POPreviewModal from "@/components/POPreviewModal";
import Toast from "@/components/Toast";
import Button from "@/components/Button";
import {
  formatINR,
  isAwaitingApproval,
  type PurchaseOrder,
} from "@/lib/types";

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/po/list?status=new", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load pending POs.");
      }
      const list = Array.isArray(data.orders) ? (data.orders as PurchaseOrder[]) : [];
      setOrders(list.filter((po) => isAwaitingApproval(po.status)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  function removeFromList(id: string) {
    setOrders((prev) => prev.filter((po) => po.id !== id));
    setSelected(null);
  }

  async function handleApprove(notes: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/po/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      removeFromList(selected.id);
      setToast("PO Approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(notes: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/po/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          reason: notes,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      removeFromList(selected.id);
      setToast("PO Rejected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="PO Approvals"
        subtitle="Review new purchase orders from Firestore and approve or reject for production."
        actions={
          <Button
            variant="secondary"
            onClick={() => void loadPending()}
            disabled={loading || busy}
          >
            Refresh
          </Button>
        }
      />

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}

      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading pending approvals…</p>
      ) : orders.length === 0 ? (
        <div className="border border-dashed border-ps-gray-300 bg-white px-6 py-16 text-center">
          <p className="font-serif text-2xl font-bold text-ps-navy">
            No pending approvals
          </p>
          <p className="mt-2 text-sm text-ps-gray-500">
            New POs uploaded by Accounting will appear here for Plant Head review.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((po) => (
            <button
              key={po.id}
              type="button"
              onClick={() => {
                setError(null);
                setSelected(po);
              }}
              className="border-l-4 border-ps-red bg-white p-5 text-left shadow-card transition hover:bg-ps-gray-50 focus:outline-none focus:ring-2 focus:ring-ps-navy/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-serif text-xl font-bold text-ps-navy">
                  {po.po_number}
                </p>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200">
                  {po.status === "new" ? "New" : "Pending"}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-ps-gray-800">
                {po.customer_name}
              </p>
              <p className="mt-1 text-xs text-ps-gray-500">{po.customer_code}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ps-gray-500">Amount</dt>
                  <dd className="font-semibold text-ps-navy">
                    {formatINR(po.total_amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ps-gray-500">Items</dt>
                  <dd className="font-semibold">{po.items.length}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-ps-gray-500">Delivery Date</dt>
                  <dd>{po.delivery_date || "—"}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <POPreviewModal
          po={selected}
          busy={busy}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={() => {
            if (!busy) setSelected(null);
          }}
        />
      )}
    </div>
  );
}
