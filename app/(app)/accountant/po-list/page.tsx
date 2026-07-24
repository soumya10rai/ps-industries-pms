"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import { formatINR, type PurchaseOrder } from "@/lib/types";

export default function POListPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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
      setSource(String(data.source || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Uploaded POs from Firestore po_uploads — BMR, Kent, and Prem samples supported."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
              Refresh
            </Button>
            <Link href="/accountant/po-upload">
              <Button>Upload PO</Button>
            </Link>
          </div>
        }
      />

      {loading && (
        <p className="mb-3 text-sm text-ps-gray-500">Loading orders…</p>
      )}
      {!loading && source && (
        <p className="mb-3 text-xs text-ps-gray-400">
          Source: {source} · {orders.length} order
          {orders.length === 1 ? "" : "s"}
        </p>
      )}
      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      {!loading && orders.length === 0 ? (
        <div className="border border-dashed border-ps-gray-300 bg-white p-10 text-center">
          <p className="font-serif text-xl font-bold text-ps-navy">
            No purchase orders yet
          </p>
          <p className="mt-2 text-sm text-ps-gray-500">
            Upload a BMR, Kent, or Prem PO to populate this list.
          </p>
          <Link href="/accountant/po-upload" className="mt-4 inline-block">
            <Button>Upload PO</Button>
          </Link>
        </div>
      ) : (
        <>
          <DataTable
            headers={[
              "PO Number",
              "Customer",
              "Date",
              "Items",
              "Total",
              "Payment",
              "Status",
              "Source",
            ]}
          >
            {orders.map((po, i) => (
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
                <Td>{po.items.length}</Td>
                <Td className="font-medium">{formatINR(po.total_amount)}</Td>
                <Td>{po.payment_terms}</Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td className="max-w-[160px] truncate text-xs">
                  {po.source_file || "—"}
                </Td>
              </TableRow>
            ))}
          </DataTable>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {orders.slice(0, 6).map((po) => (
              <div
                key={`card-${po.id}`}
                className="border-l-4 border-ps-red bg-white p-4 shadow-card"
              >
                <p className="text-xs font-semibold uppercase text-ps-gray-500">
                  {po.customer_code}
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-ps-navy">
                  {po.po_number}
                </p>
                <p className="mt-1 text-sm text-ps-gray-500">
                  {po.items.length} item{po.items.length === 1 ? "" : "s"} ·{" "}
                  {formatINR(po.total_amount)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
