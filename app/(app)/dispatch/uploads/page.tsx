"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Toast from "@/components/Toast";
import type { DispatchUpload } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function DispatchUploadsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const canDelete =
    role === "admin" || role === "accountant" || role === "plant_head";

  const [uploads, setUploads] = useState<DispatchUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatch/uploads", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load uploads.");
      setUploads(Array.isArray(data.uploads) ? data.uploads : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(uploadId: string) {
    if (!confirm("Delete this upload and all its dispatch rows?")) return;
    setBusyId(uploadId);
    try {
      const res = await fetch(
        `/api/dispatch/uploads?uploadId=${encodeURIComponent(uploadId)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setToast(`Deleted upload (${data.deletedItems ?? 0} items).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} type="success" />
      )}

      <PageHeader
        title="Dispatch Upload History"
        subtitle="Previous Schedule vs Despatch batches."
        actions={
          <>
            <Link href="/dispatch" className="text-sm font-semibold text-ps-navy">
              ← Dispatch list
            </Link>
            <Link href="/dispatch/upload">
              <Button>Upload Excel</Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ps-gray-500">Loading…</p>
      ) : uploads.length === 0 ? (
        <p className="text-sm text-ps-gray-500">No uploads yet.</p>
      ) : (
        <DataTable
          headers={[
            "Upload Date",
            "File Name",
            "Period",
            "Plant",
            "Items",
            "Uploaded By",
            "Status",
            "Actions",
          ]}
        >
          {uploads.map((u, index) => (
            <TableRow key={u.uploadId} index={index}>
              <Td>
                {u.uploadedAt
                  ? new Date(u.uploadedAt).toLocaleString("en-IN")
                  : "—"}
                {u.isLatest && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                    Latest
                  </span>
                )}
              </Td>
              <Td className="max-w-[200px] truncate">{u.fileName}</Td>
              <Td className="text-xs">
                {u.periodStart} → {u.periodEnd}
              </Td>
              <Td>{u.plant}</Td>
              <Td className="tabular-nums">{u.totalItems}</Td>
              <Td className="font-mono text-xs">{u.uploadedBy}</Td>
              <Td>
                <StatusBadge status={u.status} />
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() =>
                      router.push(
                        `/dispatch?uploadId=${encodeURIComponent(u.uploadId)}`
                      )
                    }
                  >
                    View Details
                  </Button>
                  {canDelete && (
                    <Button
                      variant="danger"
                      className="!px-3 !py-1.5 text-xs"
                      disabled={busyId === u.uploadId}
                      onClick={() => void handleDelete(u.uploadId)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Td>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
