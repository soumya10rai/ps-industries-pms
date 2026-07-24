"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import Button from "@/components/Button";
import KPICard from "@/components/KPICard";
import { MOCK_POS } from "@/lib/mock-data";
import { formatINR, type PurchaseOrder } from "@/lib/types";

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(MOCK_POS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/po/list");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) setOrders(data.orders);
      }
    } catch {
      // keep mock
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/po/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setMessage(`PO ${data.po?.po_number ?? id} approved.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Rejection reason?") || "Rejected by Plant Head";
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/po/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      setMessage(`PO ${data.po?.po_number ?? id} rejected.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = orders.filter((o) => o.status === "pending");

  return (
    <div>
      <PageHeader
        title="PO Approvals"
        subtitle="Review pending purchase orders and approve or reject for production planning."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KPICard label="Pending" value={pending.length} />
        <KPICard
          label="Pending Value"
          value={formatINR(pending.reduce((s, p) => s + p.total_amount, 0))}
        />
        <KPICard
          label="Approved"
          value={orders.filter((o) => o.status === "approved").length}
        />
      </div>

      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert-success mb-4" role="status">
          {message}
        </div>
      )}

      <DataTable
        headers={[
          "PO Number",
          "Customer",
          "Items",
          "Total",
          "Status",
          "Actions",
        ]}
      >
        {orders.map((po, i) => (
          <TableRow key={po.id} index={i}>
            <Td className="font-semibold text-ps-navy">{po.po_number}</Td>
            <Td>{po.customer_name}</Td>
            <Td>{po.items.length}</Td>
            <Td>{formatINR(po.total_amount)}</Td>
            <Td>
              <StatusBadge status={po.status} />
            </Td>
            <Td>
              {po.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => approve(po.id)}
                    disabled={busyId === po.id}
                    className="!px-3 !py-1.5 text-xs"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => reject(po.id)}
                    disabled={busyId === po.id}
                    className="!px-3 !py-1.5 text-xs"
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-ps-gray-400">—</span>
              )}
            </Td>
          </TableRow>
        ))}
      </DataTable>
    </div>
  );
}
