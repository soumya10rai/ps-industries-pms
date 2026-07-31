"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Toast from "@/components/Toast";

export default function SeedPartsPage() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/setup/parts?count=1", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCount(Number(data.count ?? 0));
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  async function seed() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/seed-parts", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed.");
      setLastResult(data.message || "Seeded.");
      setToast(data.message || "Parts master seeded");
      await refreshCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title="Seed Parts Master"
        subtitle="Load Kent RO / BMR / Prem / Haier / Veira parts into Firestore so PO entry can pick real item codes."
        actions={
          <Link href="/accountant/po-upload">
            <Button variant="secondary">PO Entry</Button>
          </Link>
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

      <div className="max-w-xl space-y-4 rounded-lg border border-ps-gray-200 bg-white px-6 py-5 shadow-card">
        <p className="text-sm text-ps-gray-600">
          Current parts in Firestore:{" "}
          <strong className="text-ps-navy">
            {count === null ? "…" : count}
          </strong>
        </p>
        <p className="text-sm text-ps-gray-500">
          FINAL.xlsx is not in the repo yet, so this seeds the hardcoded Kent
          RO parts list (~65) plus sample parts for other customers. Material
          codes match the inventory Excel import naming.
        </p>
        {lastResult && (
          <p className="text-sm text-emerald-800">{lastResult}</p>
        )}
        <Button disabled={busy} onClick={() => void seed()}>
          {busy ? "Seeding…" : "Seed parts + customers"}
        </Button>
      </div>
    </div>
  );
}
