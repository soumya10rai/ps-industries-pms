"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import { MOCK_POS } from "@/lib/mock-data";
import { formatINR, type PurchaseOrder } from "@/lib/types";

export default function POListPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(MOCK_POS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/po/list");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.orders)) {
            setOrders(data.orders);
          }
        }
      } catch {
        // Fall back to bundled mock data
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Track uploaded customer POs — BMR, Kent, and Prem sample data included."
        actions={
          <Link href="/accountant/po-upload">
            <Button>Upload PO</Button>
          </Link>
        }
      />

      {loading && (
        <p className="mb-3 text-sm text-ps-gray-500">Refreshing orders…</p>
      )}

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
        {orders.map((po) => (
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
    </div>
  );
}
