"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import Toast from "@/components/Toast";
import {
  formatINR,
  isDraftStatus,
  PO_SUBMITTED_STATUSES,
  type PurchaseOrder,
} from "@/lib/types";
import {
  hasGstBreakdown,
  poGrandTotal,
  poSubTotal,
} from "@/lib/po-gst";

type Tab = "draft" | "submitted";

export default function POListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("draft");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/po/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load purchase orders.");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const drafts = useMemo(
    () => orders.filter((o) => isDraftStatus(o.status)),
    [orders]
  );
  const submitted = useMemo(
    () =>
      orders.filter((o) =>
        (PO_SUBMITTED_STATUSES as string[]).includes(o.status)
      ),
    [orders]
  );
  const visible = tab === "draft" ? drafts : submitted;

  async function deleteDraft(po: PurchaseOrder) {
    if (
      !window.confirm(
        `Delete draft PO ${po.po_number}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(po.id);
    setError(null);
    try {
      const res = await fetch(`/api/po/${encodeURIComponent(po.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setToast(`Draft ${po.po_number} deleted`);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title="Purchase Orders"
        subtitle="Drafts stay with the accountant. Submitted POs appear in the plant head approvals queue."
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => void loadOrders()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Link href="/accountant/po-upload">
              <Button>New PO</Button>
            </Link>
          </div>
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

      <div className="flex gap-2 border-b border-ps-navy/20">
        {(
          [
            ["draft", `Drafts (${drafts.length})`],
            ["submitted", `Submitted (${submitted.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "border-b-2 border-ps-navy text-ps-navy"
                : "text-ps-gray-500 hover:text-ps-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm leading-relaxed text-ps-gray-500">
          Loading orders…
        </p>
      )}

      {!loading && visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-navy/30 bg-white px-6 py-16 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">
            {tab === "draft" ? "No drafts" : "No submitted POs"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
            {tab === "draft"
              ? "Save a PO as draft from the entry form to see it here."
              : "Submit a PO for approval to populate this list."}
          </p>
          <Link href="/accountant/po-upload" className="mt-6 inline-block">
            <Button>New PO</Button>
          </Link>
        </div>
      ) : (
        !loading && (
          <DataTable
            headers={[
              "PO Number",
              "Customer",
              "Date",
              "Plant",
              "Items",
              "Amount",
              "Status",
              "Actions",
            ]}
          >
            {visible.map((po, i) => (
              <TableRow key={po.id} index={i}>
                <Td className="font-semibold text-ps-navy">{po.po_number}</Td>
                <Td>
                  <div>
                    <p className="font-medium">{po.customer_code}</p>
                    <p className="max-w-[220px] truncate text-xs text-ps-gray-500">
                      {po.customer_name}
                    </p>
                  </div>
                </Td>
                <Td>{po.po_date}</Td>
                <Td className="text-xs">{po.plant || "—"}</Td>
                <Td>{po.items.length}</Td>
                <Td>
                  {hasGstBreakdown(po) ? (
                    <div>
                      <p className="text-xs text-ps-gray-500">
                        Sub: {formatINR(poSubTotal(po))}
                      </p>
                      <p className="font-semibold text-ps-navy">
                        Grand: {formatINR(poGrandTotal(po))}
                      </p>
                    </div>
                  ) : (
                    <span className="font-medium">
                      {formatINR(po.total_amount)}
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td>
                  {isDraftStatus(po.status) ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          router.push(
                            `/accountant/po-upload?id=${encodeURIComponent(po.id)}`
                          )
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === po.id}
                        onClick={() => void deleteDraft(po)}
                      >
                        {busyId === po.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  ) : po.pdf_url ? (
                    <a
                      href={po.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-ps-navy underline"
                    >
                      PDF
                    </a>
                  ) : (
                    <span className="text-xs text-ps-gray-400">—</span>
                  )}
                </Td>
              </TableRow>
            ))}
          </DataTable>
        )
      )}
    </div>
  );
}
