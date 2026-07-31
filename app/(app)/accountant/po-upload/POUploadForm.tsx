"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Toast from "@/components/Toast";
import {
  aggregatePoTax,
  calcLineTax,
  DEFAULT_CGST_PERCENT,
  DEFAULT_HSN_CODE,
  DEFAULT_IGST_PERCENT,
  DEFAULT_SGST_PERCENT,
} from "@/lib/po-gst";
import {
  DEFAULT_CUSTOMERS,
  INVENTORY_PLANTS,
  formatINR,
  type CustomerMaster,
  type InventoryPlant,
  type PartMaster,
  type PurchaseOrder,
} from "@/lib/types";

type Step = "pdf" | "form";

interface LineDraft {
  key: string;
  itemCode: string;
  description: string;
  hsnCode: string;
  quantity: string;
  rate: string;
  cgstPercent: string;
  sgstPercent: string;
  igstPercent: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(interstate: boolean): LineDraft {
  return {
    key: `line_${Math.random().toString(36).slice(2, 9)}`,
    itemCode: "",
    description: "",
    hsnCode: DEFAULT_HSN_CODE,
    quantity: "",
    rate: "",
    cgstPercent: interstate ? "0" : String(DEFAULT_CGST_PERCENT),
    sgstPercent: interstate ? "0" : String(DEFAULT_SGST_PERCENT),
    igstPercent: interstate ? String(DEFAULT_IGST_PERCENT) : "0",
  };
}

function lineTax(line: LineDraft, interstate: boolean) {
  return calcLineTax({
    quantity: Number(line.quantity) || 0,
    rate: Number(line.rate) || 0,
    cgstPercent: Number(line.cgstPercent) || 0,
    sgstPercent: Number(line.sgstPercent) || 0,
    igstPercent: Number(line.igstPercent) || 0,
    interstate,
  });
}

export default function POUploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id") || "";

  const [step, setStep] = useState<Step>("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfSize, setPdfSize] = useState<number | null>(null);

  const [poNumber, setPoNumber] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [poDate, setPoDate] = useState(todayIso());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [plant, setPlant] = useState<InventoryPlant>(INVENTORY_PLANTS[0]);
  const [interstate, setInterstate] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([
    emptyLine(false),
    emptyLine(false),
  ]);

  const [customers, setCustomers] =
    useState<CustomerMaster[]>(DEFAULT_CUSTOMERS);
  const [parts, setParts] = useState<PartMaster[]>([]);
  const [partsEmpty, setPartsEmpty] = useState(false);
  const [draftId, setDraftId] = useState<string>(editId);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.code === customerCode) || null,
    [customers, customerCode]
  );

  const customerParts = useMemo(() => {
    if (!customerCode) return [];
    return parts.filter((p) => p.customerCode === customerCode);
  }, [parts, customerCode]);

  const totals = useMemo(() => {
    const computed = lines.map((l) => lineTax(l, interstate));
    return aggregatePoTax(computed);
  }, [lines, interstate]);

  const loadMasters = useCallback(async () => {
    try {
      const [custRes, countRes, partsRes] = await Promise.all([
        fetch("/api/setup/customers", { cache: "no-store" }),
        fetch("/api/setup/parts?count=1", { cache: "no-store" }),
        fetch("/api/setup/parts", { cache: "no-store" }),
      ]);
      const custData = await custRes.json();
      const countData = await countRes.json();
      const partsData = await partsRes.json();

      if (Array.isArray(custData.customers) && custData.customers.length) {
        setCustomers(custData.customers);
      }
      setPartsEmpty(Boolean(countData.empty || countData.count === 0));
      setParts(Array.isArray(partsData.parts) ? partsData.parts : []);
    } catch {
      setPartsEmpty(true);
    }
  }, []);

  const loadDraft = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/po/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load draft.");
      const po = data.po as PurchaseOrder;
      if (po.status !== "draft") {
        throw new Error("Only draft POs can be edited here.");
      }
      const isInter = po.interstate === true;
      setDraftId(po.id);
      setPoNumber(po.po_number);
      setCustomerCode(po.customer_code);
      setPoDate(po.po_date || todayIso());
      setDeliveryDate(po.delivery_date || "");
      setPaymentTerms(po.payment_terms || "");
      setInterstate(isInter);
      if (
        po.plant &&
        (INVENTORY_PLANTS as readonly string[]).includes(po.plant)
      ) {
        setPlant(po.plant as InventoryPlant);
      }
      setPdfUrl(po.pdf_url || null);
      setPdfName(po.source_file || null);
      setLines(
        po.items.length
          ? po.items.map((item) => ({
              key: `line_${item.item_code}_${Math.random().toString(36).slice(2, 6)}`,
              itemCode: item.item_code,
              description: item.description,
              hsnCode: item.hsn_code || DEFAULT_HSN_CODE,
              quantity: String(item.quantity),
              rate: String(item.rate),
              cgstPercent: String(
                item.cgst_percent ?? (isInter ? 0 : DEFAULT_CGST_PERCENT)
              ),
              sgstPercent: String(
                item.sgst_percent ?? (isInter ? 0 : DEFAULT_SGST_PERCENT)
              ),
              igstPercent: String(
                item.igst_percent ?? (isInter ? DEFAULT_IGST_PERCENT : 0)
              ),
            }))
          : [emptyLine(isInter)]
      );
      setStep("form");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load draft.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    if (editId) void loadDraft(editId);
  }, [editId, loadDraft]);

  function applyInterstate(next: boolean) {
    setInterstate(next);
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        cgstPercent: next ? "0" : String(DEFAULT_CGST_PERCENT),
        sgstPercent: next ? "0" : String(DEFAULT_SGST_PERCENT),
        igstPercent: next ? String(DEFAULT_IGST_PERCENT) : "0",
      }))
    );
  }

  async function uploadPdf(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/po/upload", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PDF upload failed.");
      setPdfUrl(data.pdfUrl);
      setPdfName(data.fileName || file.name);
      setPdfSize(data.sizeBytes ?? file.size);
      setStep("form");
      setToast("PDF uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }

  function selectPart(key: string, itemCode: string) {
    const part = customerParts.find((p) => p.itemCode === itemCode);
    updateLine(key, {
      itemCode,
      description: part?.description || "",
      hsnCode: part?.defaultHsnCode || DEFAULT_HSN_CODE,
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!poNumber.trim()) next.poNumber = "Required";
    if (!customerCode) next.customerCode = "Required";
    if (!poDate) next.poDate = "Required";
    if (!deliveryDate) next.deliveryDate = "Required";
    if (!plant) next.plant = "Required";

    const filled = lines.filter((l) => l.itemCode || l.quantity || l.rate);
    if (filled.length === 0) next.lines = "Add at least one line item";

    filled.forEach((l, i) => {
      if (!l.itemCode) next[`item_${l.key}`] = `Line ${i + 1}: select a part`;
      if (!l.hsnCode.trim()) next[`hsn_${l.key}`] = "HSN required";
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        next[`qty_${l.key}`] = "Qty must be > 0";
      }
      if (
        l.rate === "" ||
        Number(l.rate) < 0 ||
        !Number.isFinite(Number(l.rate))
      ) {
        next[`rate_${l.key}`] = "Rate must be ≥ 0";
      }
    });

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(status: "draft" | "new") {
    if (!validate()) {
      setError("Fix the highlighted fields before saving.");
      return;
    }
    if (!selectedCustomer) {
      setError("Select a customer.");
      return;
    }

    setBusy(true);
    setError(null);

    const payloadItems = lines
      .filter((l) => l.itemCode)
      .map((l) => {
        const tax = lineTax(l, interstate);
        return {
          itemCode: l.itemCode,
          description: l.description,
          hsnCode: l.hsnCode.trim(),
          quantity: Number(l.quantity),
          unit: "NOS",
          rate: Number(l.rate),
          subTotal: tax.subTotal,
          cgstPercent: tax.cgstPercent,
          cgstAmount: tax.cgstAmount,
          sgstPercent: tax.sgstPercent,
          sgstAmount: tax.sgstAmount,
          igstPercent: tax.igstPercent,
          igstAmount: tax.igstAmount,
          total: tax.total,
        };
      });

    try {
      const res = await fetch("/api/po/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          poId: draftId || undefined,
          poNumber: poNumber.trim(),
          customerCode: selectedCustomer.code,
          customerName: selectedCustomer.name,
          poDate,
          deliveryDate,
          paymentTerms: paymentTerms.trim(),
          plant,
          pdfUrl: pdfUrl || undefined,
          sourceFile: pdfName || undefined,
          interstate,
          items: payloadItems,
          subTotal: totals.subTotal,
          totalCgst: totals.totalCgst,
          totalSgst: totals.totalSgst,
          totalIgst: totals.totalIgst,
          totalTax: totals.totalTax,
          grandTotal: totals.grandTotal,
          totalAmount: totals.grandTotal,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");

      setToast(
        status === "draft" ? "Draft saved" : "PO submitted for approval"
      );
      setTimeout(() => {
        router.push("/accountant/po-list");
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-section">
      <PageHeader
        title={draftId ? "Edit Draft PO" : "Enter Purchase Order"}
        subtitle="Upload the customer PDF for records, then enter PO details with HSN and GST."
        actions={
          <Link href="/accountant/po-list">
            <Button variant="secondary">Back to list</Button>
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

      {partsEmpty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Parts master is empty</p>
          <p className="mt-1">
            Ask admin to seed parts data first. Go to{" "}
            <Link href="/admin/seed-parts" className="font-semibold underline">
              /admin/seed-parts
            </Link>{" "}
            to load parts.
          </p>
        </div>
      )}

      {step === "pdf" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void uploadPdf(file);
            }}
            className={`rounded-lg border-2 border-dashed bg-white px-6 py-14 text-center shadow-card transition ${
              dragOver ? "border-ps-navy bg-ps-gray-50" : "border-ps-navy/30"
            }`}
          >
            <p className="font-serif text-ps-h2 text-ps-navy">
              Drop PO PDF here
            </p>
            <p className="mt-2 text-sm text-ps-gray-500">
              Stored for audit only — you will enter the line items next.
            </p>
            <label className="mt-6 inline-flex cursor-pointer">
              <span className="rounded-lg bg-ps-navy px-6 py-2.5 text-sm font-semibold text-white shadow-btn">
                {busy ? "Uploading…" : "Choose PDF"}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPdf(file);
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-ps-navy underline"
            disabled={busy}
            onClick={() => setStep("form")}
          >
            Skip PDF, enter manually
          </button>
        </div>
      )}

      {step === "form" && (
        <div className="space-y-6">
          {(pdfUrl || pdfName) && (
            <div className="rounded-lg border border-ps-gray-200 bg-white px-4 py-3 text-sm shadow-card">
              <p className="font-semibold text-ps-navy">PDF reference</p>
              <p className="mt-1 text-ps-gray-600">
                {pdfName || "Uploaded PDF"}
                {pdfSize != null ? ` · ${(pdfSize / 1024).toFixed(1)} KB` : ""}
              </p>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-ps-navy underline"
                >
                  Open stored PDF
                </a>
              )}
            </div>
          )}

          <div className="grid gap-4 rounded-lg border border-ps-gray-200 bg-white px-6 py-5 shadow-card sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">
              <span className="field-label">PO Number *</span>
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className={`field-input ${fieldErrors.poNumber ? "field-input-error" : ""}`}
                placeholder="4400042956-0"
              />
            </label>

            <label className="block text-sm">
              <span className="field-label">Customer *</span>
              <select
                value={customerCode}
                onChange={(e) => {
                  setCustomerCode(e.target.value);
                  setLines((prev) =>
                    prev.map((l) => ({
                      ...l,
                      itemCode: "",
                      description: "",
                      hsnCode: DEFAULT_HSN_CODE,
                    }))
                  );
                }}
                className={`field-input ${fieldErrors.customerCode ? "field-input-error" : ""}`}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="field-label">Plant *</span>
              <select
                value={plant}
                onChange={(e) => setPlant(e.target.value as InventoryPlant)}
                className={`field-input ${fieldErrors.plant ? "field-input-error" : ""}`}
              >
                {INVENTORY_PLANTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="field-label">PO Date *</span>
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className={`field-input ${fieldErrors.poDate ? "field-input-error" : ""}`}
              />
            </label>

            <label className="block text-sm">
              <span className="field-label">Delivery Date *</span>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={`field-input ${fieldErrors.deliveryDate ? "field-input-error" : ""}`}
              />
            </label>

            <label className="block text-sm">
              <span className="field-label">Payment Terms</span>
              <input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="field-input"
                placeholder="45 days"
              />
            </label>

            <label className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={interstate}
                onChange={(e) => applyInterstate(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-ps-navy">
                Inter-state PO (apply IGST 18% instead of CGST+SGST)
              </span>
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-ps-gray-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-ps-navy/20 px-4 py-3">
              <h2 className="font-serif text-ps-h2 text-ps-navy">Line items</h2>
              <Button
                variant="secondary"
                disabled={busy || !customerCode}
                onClick={() =>
                  setLines((prev) => [...prev, emptyLine(interstate)])
                }
              >
                + Add Line Item
              </Button>
            </div>

            {!customerCode && (
              <p className="px-4 py-3 text-sm text-ps-gray-500">
                Select a customer to enable the parts dropdown.
              </p>
            )}

            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-ps-navy text-white">
                <tr>
                  <th className="px-2 py-3 text-xs uppercase">Item</th>
                  <th className="px-2 py-3 text-xs uppercase">Description</th>
                  <th className="px-2 py-3 text-xs uppercase">HSN</th>
                  <th className="px-2 py-3 text-xs uppercase">Qty</th>
                  <th className="px-2 py-3 text-xs uppercase">Rate</th>
                  <th className="px-2 py-3 text-xs uppercase">Sub Total</th>
                  {!interstate && (
                    <>
                      <th className="px-2 py-3 text-xs uppercase">CGST %</th>
                      <th className="px-2 py-3 text-xs uppercase">CGST ₹</th>
                      <th className="px-2 py-3 text-xs uppercase">SGST %</th>
                      <th className="px-2 py-3 text-xs uppercase">SGST ₹</th>
                    </>
                  )}
                  {interstate && (
                    <>
                      <th className="px-2 py-3 text-xs uppercase">IGST %</th>
                      <th className="px-2 py-3 text-xs uppercase">IGST ₹</th>
                    </>
                  )}
                  <th className="px-2 py-3 text-xs uppercase">Total</th>
                  <th className="px-2 py-3 text-xs uppercase" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const tax = lineTax(line, interstate);
                  return (
                    <tr
                      key={line.key}
                      className={
                        i % 2 === 0 ? "bg-white" : "bg-ps-gray-50/80"
                      }
                    >
                      <td className="px-2 py-2 align-top">
                        <select
                          value={line.itemCode}
                          disabled={!customerCode || busy}
                          onChange={(e) =>
                            selectPart(line.key, e.target.value)
                          }
                          className={`field-input min-w-[180px] ${
                            fieldErrors[`item_${line.key}`]
                              ? "field-input-error"
                              : ""
                          }`}
                        >
                          <option value="">Select part…</option>
                          {customerParts.map((p) => (
                            <option key={p.itemCode} value={p.itemCode}>
                              {p.itemCode} - {p.description}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.key, {
                              description: e.target.value,
                            })
                          }
                          className="field-input min-w-[140px]"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={line.hsnCode}
                          onChange={(e) =>
                            updateLine(line.key, { hsnCode: e.target.value })
                          }
                          className={`field-input w-24 ${
                            fieldErrors[`hsn_${line.key}`]
                              ? "field-input-error"
                              : ""
                          }`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, { quantity: e.target.value })
                          }
                          className={`field-input w-24 ${
                            fieldErrors[`qty_${line.key}`]
                              ? "field-input-error"
                              : ""
                          }`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.rate}
                          onChange={(e) =>
                            updateLine(line.key, { rate: e.target.value })
                          }
                          className={`field-input w-24 ${
                            fieldErrors[`rate_${line.key}`]
                              ? "field-input-error"
                              : ""
                          }`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top whitespace-nowrap text-ps-gray-600">
                        {formatINR(tax.subTotal)}
                      </td>
                      {!interstate && (
                        <>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min={0}
                              max={30}
                              step="0.01"
                              value={line.cgstPercent}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  cgstPercent: e.target.value,
                                })
                              }
                              className="field-input w-16"
                            />
                          </td>
                          <td className="px-2 py-2 align-top whitespace-nowrap text-ps-gray-600">
                            {formatINR(tax.cgstAmount)}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min={0}
                              max={30}
                              step="0.01"
                              value={line.sgstPercent}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  sgstPercent: e.target.value,
                                })
                              }
                              className="field-input w-16"
                            />
                          </td>
                          <td className="px-2 py-2 align-top whitespace-nowrap text-ps-gray-600">
                            {formatINR(tax.sgstAmount)}
                          </td>
                        </>
                      )}
                      {interstate && (
                        <>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min={0}
                              max={30}
                              step="0.01"
                              value={line.igstPercent}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  igstPercent: e.target.value,
                                })
                              }
                              className="field-input w-16"
                            />
                          </td>
                          <td className="px-2 py-2 align-top whitespace-nowrap text-ps-gray-600">
                            {formatINR(tax.igstAmount)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 align-top whitespace-nowrap font-semibold text-ps-navy">
                        {formatINR(tax.total)}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <button
                          type="button"
                          className="text-xs font-semibold text-ps-red"
                          disabled={busy || lines.length <= 1}
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.key !== line.key)
                            )
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="border-t border-ps-navy/20 bg-ps-gray-50 px-6 py-4">
              <dl className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-ps-gray-600">
                  <dt>Sub Total</dt>
                  <dd>{formatINR(totals.subTotal)}</dd>
                </div>
                {!interstate && (
                  <>
                    <div className="flex justify-between text-ps-gray-600">
                      <dt>CGST</dt>
                      <dd>{formatINR(totals.totalCgst)}</dd>
                    </div>
                    <div className="flex justify-between text-ps-gray-600">
                      <dt>SGST</dt>
                      <dd>{formatINR(totals.totalSgst)}</dd>
                    </div>
                  </>
                )}
                {interstate && (
                  <div className="flex justify-between text-ps-gray-600">
                    <dt>IGST</dt>
                    <dd>{formatINR(totals.totalIgst)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-ps-navy/20 pt-2 font-serif text-ps-h2 text-ps-navy">
                  <dt>Grand Total</dt>
                  <dd>{formatINR(totals.grandTotal)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-ps-navy/20 pt-4">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => router.push("/accountant/po-list")}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={busy || partsEmpty}
              onClick={() => void save("draft")}
            >
              {busy ? "Saving…" : "Save as Draft"}
            </Button>
            <Button
              disabled={busy || partsEmpty}
              onClick={() => void save("new")}
            >
              {busy ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
