"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Toast from "@/components/Toast";
import { formatINR, type PurchaseOrder } from "@/lib/types";

const SAMPLE_FILES = [
  {
    label: "BMR HVAC",
    filename: "BMR_HVAC_PO_4400042956-0.pdf",
    hint: "4400042956-0 · 2 items · ₹13,25,507",
  },
  {
    label: "Kent RO",
    filename: "Kent_RO_PO_426RM0461.xlsx",
    hint: "426RM0461 · 2 items · ₹3,90,735",
  },
  {
    label: "Prem Industries",
    filename: "Prem_Industries_PO_000612.pdf",
    hint: "000612 · 1 item · ₹84,800",
  },
] as const;

export default function POUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PurchaseOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    if (!busy) setModalOpen(false);
  }, [busy]);

  async function parseByFilename(filename: string, selectedFile?: File | null) {
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      let res: Response;

      if (selectedFile) {
        const body = new FormData();
        body.append("file", selectedFile);
        res = await fetch("/api/po/upload", { method: "POST", body });
      } else {
        res = await fetch("/api/po/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      const po = data.po as PurchaseOrder;
      setPreview(po);
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleParse(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF or Excel purchase order to upload.");
      return;
    }
    await parseByFilename(file.name, file);
  }

  async function handleConfirmSave() {
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

      setModalOpen(false);
      setToast("PO saved successfully");
      setTimeout(() => {
        router.push("/accountant/po-list");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title="Upload Purchase Order"
        subtitle="Select a PDF or Excel PO. Filenames with BMR, Kent, or Prem map to the Greater Noida sample fixtures."
      />

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}

      <div className="grid gap-8 sm:grid-cols-3">
        {SAMPLE_FILES.map((sample) => (
          <button
            key={sample.filename}
            type="button"
            disabled={busy}
            onClick={() => parseByFilename(sample.filename)}
            className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 text-left shadow-card transition duration-200 ease-in-out hover:bg-ps-gray-100 hover:shadow-card-hover disabled:opacity-60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
              Quick sample
            </p>
            <p className="mt-2 font-serif text-ps-h2 text-ps-navy">
              {sample.label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ps-gray-500">
              {sample.hint}
            </p>
            <p className="mt-2 truncate text-[11px] text-ps-gray-400">
              {sample.filename}
            </p>
          </button>
        ))}
      </div>

      <form
        onSubmit={handleParse}
        className="max-w-xl rounded-lg border border-ps-gray-200 bg-white px-6 py-4 shadow-card"
      >
        <label htmlFor="po-file" className="field-label">
          PO file (PDF / Excel)
        </label>
        <input
          id="po-file"
          type="file"
          accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className={`field-input file:mr-3 file:rounded-lg file:border-0 file:bg-ps-navy file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white file:transition file:duration-200 file:ease-in-out hover:file:bg-[#163075] ${
            error ? "field-input-error" : ""
          }`}
        />
        {file && (
          <p className="mt-2 text-sm leading-relaxed text-ps-gray-600">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-ps-gray-500">
          Tip: name files with <strong>BMR</strong>, <strong>Kent</strong>, or{" "}
          <strong>Prem</strong> (or PO numbers) to load the matching fixture.
        </p>

        {error && (
          <div className="alert-error mt-4" role="alert">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3 border-t border-ps-navy/20 pt-4">
          <Button type="submit" disabled={busy || !file}>
            {busy && !modalOpen ? "Parsing…" : "Parse PO"}
          </Button>
        </div>
      </form>

      {modalOpen && preview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="po-preview-title"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-ps-gray-200 bg-white shadow-card-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-ps-navy/20 bg-ps-navy px-6 py-4 text-white">
              <div>
                <h2
                  id="po-preview-title"
                  className="font-serif text-ps-h2 text-white"
                >
                  PO Preview
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-blue-100">
                  Review parsed data before saving to Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-lg leading-none transition duration-200 ease-in-out hover:bg-white/10"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4">
              <dl className="grid gap-4 text-sm leading-relaxed sm:grid-cols-2">
                <div>
                  <dt className="text-ps-gray-500">PO Number</dt>
                  <dd className="font-semibold text-ps-navy">
                    {preview.po_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-ps-gray-500">Customer</dt>
                  <dd className="font-semibold">{preview.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-ps-gray-500">Date</dt>
                  <dd>{preview.po_date}</dd>
                </div>
                <div>
                  <dt className="text-ps-gray-500">Payment Terms</dt>
                  <dd>{preview.payment_terms}</dd>
                </div>
                <div>
                  <dt className="text-ps-gray-500">Items</dt>
                  <dd>{preview.items.length}</dd>
                </div>
                <div>
                  <dt className="text-ps-gray-500">Total</dt>
                  <dd className="font-semibold text-ps-navy">
                    {formatINR(preview.total_amount)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ps-gray-500">Source file</dt>
                  <dd className="truncate text-xs">{preview.source_file}</dd>
                </div>
              </dl>

              <div className="mt-6 overflow-x-auto rounded-lg border border-ps-gray-200">
                <table className="min-w-full text-left text-sm leading-relaxed">
                  <thead className="bg-ps-navy text-white">
                    <tr>
                      <th className="px-6 py-3 text-xs uppercase">Code</th>
                      <th className="px-6 py-3 text-xs uppercase">Description</th>
                      <th className="px-6 py-3 text-xs uppercase">Qty</th>
                      <th className="px-6 py-3 text-xs uppercase">Rate</th>
                      <th className="px-6 py-3 text-xs uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item, i) => (
                      <tr
                        key={`${item.item_code}-${i}`}
                        className={`transition duration-200 ease-in-out hover:bg-ps-gray-100 ${
                          i % 2 === 0 ? "bg-white" : "bg-ps-gray-50/80"
                        }`}
                      >
                        <td className="px-6 py-3.5 font-medium text-ps-navy">
                          {item.item_code}
                        </td>
                        <td className="px-6 py-3.5">{item.description}</td>
                        <td className="px-6 py-3.5">
                          {item.quantity.toLocaleString("en-IN")} {item.uom}
                        </td>
                        <td className="px-6 py-3.5">{item.rate}</td>
                        <td className="px-6 py-3.5">{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="alert-error mt-4" role="alert">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-ps-navy/20 pt-4">
                <Button variant="secondary" onClick={closeModal} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmSave} disabled={busy}>
                  {busy ? "Saving…" : "Confirm & Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
