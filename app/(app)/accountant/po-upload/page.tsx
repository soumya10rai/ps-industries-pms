"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { formatINR, type PurchaseOrder } from "@/lib/types";

export default function POUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PurchaseOrder | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleParse(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPreview(null);

    if (!file) {
      setError("Choose a PDF purchase order to upload.");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/po/upload", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setPreview(data.po as PurchaseOrder);
      setMessage("PO parsed successfully. Review and save to the list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/po/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po: preview }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save failed.");
      }
      setMessage("Purchase order saved.");
      setTimeout(() => router.push("/accountant/po-list"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Upload Purchase Order"
        subtitle="Import a customer PO PDF. Matching sample files map to BMR, Kent, or Prem fixtures."
      />

      <form
        onSubmit={handleParse}
        className="max-w-xl border border-ps-gray-200 bg-white p-6 shadow-card"
      >
        <label htmlFor="po-file" className="field-label">
          PO PDF file
        </label>
        <input
          id="po-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="field-input file:mr-3 file:rounded file:border-0 file:bg-ps-navy file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-2 text-xs text-ps-gray-500">
          Tip: name files with BMR, Kent, or Prem to load the matching sample PO.
        </p>

        {error && (
          <div className="alert-error mt-4" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="alert-success mt-4" role="status">
            {message}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Parsing…" : "Parse PO"}
          </Button>
        </div>
      </form>

      {preview && (
        <section className="mt-8 max-w-3xl border border-ps-gray-200 bg-white p-6 shadow-card">
          <h2 className="font-serif text-xl font-bold text-ps-navy">
            Parsed Preview
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-ps-gray-500">PO Number</dt>
              <dd className="font-semibold text-ps-navy">{preview.po_number}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Customer</dt>
              <dd className="font-semibold">{preview.customer_name}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Items</dt>
              <dd>{preview.items.length}</dd>
            </div>
            <div>
              <dt className="text-ps-gray-500">Total</dt>
              <dd className="font-semibold">
                {formatINR(preview.total_amount)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ps-navy text-white">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase">Code</th>
                  <th className="px-3 py-2 text-xs uppercase">Description</th>
                  <th className="px-3 py-2 text-xs uppercase">Qty</th>
                  <th className="px-3 py-2 text-xs uppercase">Rate</th>
                  <th className="px-3 py-2 text-xs uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, i) => (
                  <tr
                    key={item.item_code}
                    className={i % 2 === 0 ? "bg-white" : "bg-ps-gray-50"}
                  >
                    <td className="px-3 py-2">{item.item_code}</td>
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
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save Purchase Order"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
