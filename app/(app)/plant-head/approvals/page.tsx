"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import POPreviewModal from "@/components/POPreviewModal";
import Toast from "@/components/Toast";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import {
  formatINR,
  isAwaitingApproval,
  type PurchaseOrder,
} from "@/lib/types";

export default function ApprovalsPage() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/po/list?status=new", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load pending POs.");
      }
      const list = Array.isArray(data.orders)
        ? (data.orders as PurchaseOrder[])
        : [];
      setOrders(list.filter((po) => isAwaitingApproval(po.status)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load approvals."
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending, refreshKey]);

  async function resolveCurrentUid(): Promise<string> {
    if (user?.uid) return user.uid;
    if (profile?.uid) return profile.uid;
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        return String(data?.user?.uid || "");
      }
    } catch {
      // ignore
    }
    return "";
  }

  async function handleApprove(notes: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const poId = selected.id;
    const approvedBy = await resolveCurrentUid();

    try {
      const res = await fetch("/api/po/approve", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: poId,
          approved_by: approvedBy,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const shortfallMsg =
          Array.isArray(data.shortfalls) && data.shortfalls.length
            ? ` Shortfall: ${data.shortfalls
                .map(
                  (s: { material: string; shortfall_kg: number }) =>
                    `${s.material} (${s.shortfall_kg} kg)`
                )
                .join(", ")}`
            : "";
        throw new Error(
          (data.error || `Approve failed (${res.status})`) + shortfallMsg
        );
      }

      setOrders((prev) => prev.filter((po) => po.id !== poId));
      setSelected(null);
      setToast(
        typeof data.message === "string" && data.message
          ? data.message
          : "PO Approved"
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(notes: string) {
    if (!selected) return;
    const reason = notes.trim();
    if (!reason) {
      setError("Notes are required to reject a purchase order.");
      return;
    }

    setBusy(true);
    setError(null);
    const poId = selected.id;
    const approvedBy = await resolveCurrentUid();

    try {
      const res = await fetch("/api/po/reject", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: poId,
          rejection_reason: reason,
          approved_by: approvedBy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Reject failed (${res.status})`);
      }

      setOrders((prev) => prev.filter((po) => po.id !== poId));
      setSelected(null);
      setToast("PO Rejected");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title="PO Approvals"
        subtitle="Review new purchase orders from Firestore and approve or reject for production."
        actions={
          <Button
            variant="secondary"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading || busy}
          >
            Refresh
          </Button>
        }
      />

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}

      {error && !selected && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm leading-relaxed text-ps-gray-500">
          Loading pending approvals…
        </p>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-navy/30 bg-white px-6 py-16 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">
            No pending approvals
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
            New POs uploaded by Accounting will appear here for Plant Head
            review.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((po) => (
            <button
              key={po.id}
              type="button"
              onClick={() => {
                setError(null);
                setSelected(po);
              }}
              className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 text-left shadow-card transition duration-200 ease-in-out hover:bg-ps-gray-100 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-ps-navy/30"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-serif text-ps-h2 text-ps-navy">
                  {po.po_number}
                </p>
                <StatusBadge
                  status={po.status === "new" ? "pending" : po.status}
                />
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-ps-gray-800">
                {po.customer_name}
              </p>
              <p className="mt-1 text-xs text-ps-gray-500">{po.customer_code}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-ps-navy/20 pt-4 text-sm leading-relaxed">
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
          error={error}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={() => {
            if (!busy) {
              setSelected(null);
              setError(null);
            }
          }}
        />
      )}
    </div>
  );
}
