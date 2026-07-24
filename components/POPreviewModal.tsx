"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { formatINR, type PurchaseOrder } from "@/lib/types";

interface POPreviewModalProps {
  po: PurchaseOrder;
  busy?: boolean;
  error?: string | null;
  onApprove: (notes: string) => void | Promise<void>;
  onReject: (notes: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function POPreviewModal({
  po,
  busy = false,
  error = null,
  onApprove,
  onReject,
  onCancel,
}: POPreviewModalProps) {
  const [notes, setNotes] = useState(po.rejection_reason || "");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleApprove() {
    setLocalError(null);
    await onApprove(notes.trim());
  }

  async function handleReject() {
    if (!notes.trim()) {
      setLocalError("Notes are required to reject a purchase order.");
      return;
    }
    setLocalError(null);
    await onReject(notes.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="po-approval-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded border border-ps-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ps-gray-100 bg-ps-navy px-5 py-4 text-white">
          <div>
            <h2 id="po-approval-title" className="font-serif text-xl font-bold">
              Review Purchase Order
            </h2>
            <p className="mt-0.5 text-xs text-blue-100">
              Approve or reject for Greater Noida Plant
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded px-2 py-1 text-lg leading-none hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-ps-gray-500">PO Number</dt>
              <dd className="font-semibold text-ps-navy">{po.po_number}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Customer</dt>
              <dd className="font-semibold">{po.customer_name}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Date</dt>
              <dd>{po.po_date || "—"}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Delivery</dt>
              <dd>{po.delivery_date || "—"}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Items</dt>
              <dd>{po.items.length}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Total Amount</dt>
              <dd className="font-semibold text-ps-navy">
                {formatINR(po.total_amount)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 overflow-x-auto border border-ps-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ps-navy text-white">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase">Item Code</th>
                  <th className="px-3 py-2 text-xs uppercase">Description</th>
                  <th className="px-3 py-2 text-xs uppercase">Qty</th>
                  <th className="px-3 py-2 text-xs uppercase">Rate</th>
                  <th className="px-3 py-2 text-xs uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, i) => (
                  <tr
                    key={`${item.item_code}-${i}`}
                    className={i % 2 === 0 ? "bg-white" : "bg-ps-gray-50"}
                  >
                    <td className="px-3 py-2 font-medium text-ps-navy">
                      {item.item_code}
                    </td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">
                      {item.quantity.toLocaleString("en-IN")} {item.uom}
                    </td>
                    <td className="px-3 py-2">{item.rate}</td>
                    <td className="px-3 py-2">{formatINR(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <label htmlFor="approval-notes" className="field-label">
              Notes
            </label>
            <textarea
              id="approval-notes"
              rows={3}
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Required when rejecting — optional for approval"
              className="field-input min-h-[88px] resize-y"
            />
          </div>

          {(localError || error) && (
            <div className="alert-error mt-4" role="alert">
              {localError || error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleReject()}
              className="inline-flex items-center justify-center rounded bg-ps-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working…" : "Reject"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleApprove()}
              className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working…" : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
