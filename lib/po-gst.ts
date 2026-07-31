/**
 * GST / HSN helpers for purchase orders.
 * Intra-state default: 9% CGST + 9% SGST. Inter-state: 18% IGST.
 */

import type { POItem, PurchaseOrder } from "@/lib/types";

export const DEFAULT_HSN_CODE = "392690";
export const DEFAULT_CGST_PERCENT = 9;
export const DEFAULT_SGST_PERCENT = 9;
export const DEFAULT_IGST_PERCENT = 18;

export function roundMoney(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

export function withinTolerance(
  actual: number,
  expected: number,
  tolerance: number
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

export interface LineTaxInput {
  quantity: number;
  rate: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  interstate?: boolean;
}

export interface LineTaxResult {
  subTotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  igstPercent: number;
  igstAmount: number;
  total: number;
}

export function calcLineTax(input: LineTaxInput): LineTaxResult {
  const subTotal = roundMoney(input.quantity * input.rate);
  const interstate = Boolean(input.interstate);

  if (interstate) {
    const igstPercent =
      input.igstPercent !== undefined
        ? Number(input.igstPercent)
        : DEFAULT_IGST_PERCENT;
    const igstAmount = roundMoney((subTotal * igstPercent) / 100);
    return {
      subTotal,
      cgstPercent: 0,
      cgstAmount: 0,
      sgstPercent: 0,
      sgstAmount: 0,
      igstPercent,
      igstAmount,
      total: roundMoney(subTotal + igstAmount),
    };
  }

  const cgstPercent =
    input.cgstPercent !== undefined
      ? Number(input.cgstPercent)
      : DEFAULT_CGST_PERCENT;
  const sgstPercent =
    input.sgstPercent !== undefined
      ? Number(input.sgstPercent)
      : DEFAULT_SGST_PERCENT;
  const cgstAmount = roundMoney((subTotal * cgstPercent) / 100);
  const sgstAmount = roundMoney((subTotal * sgstPercent) / 100);

  return {
    subTotal,
    cgstPercent,
    cgstAmount,
    sgstPercent,
    sgstAmount,
    igstPercent: 0,
    igstAmount: 0,
    total: roundMoney(subTotal + cgstAmount + sgstAmount),
  };
}

export interface PoTaxTotals {
  subTotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
}

export function aggregatePoTax(
  lines: Array<Pick<
    LineTaxResult,
    "subTotal" | "cgstAmount" | "sgstAmount" | "igstAmount" | "total"
  >>
): PoTaxTotals {
  const subTotal = roundMoney(
    lines.reduce((s, l) => s + l.subTotal, 0)
  );
  const totalCgst = roundMoney(
    lines.reduce((s, l) => s + l.cgstAmount, 0)
  );
  const totalSgst = roundMoney(
    lines.reduce((s, l) => s + l.sgstAmount, 0)
  );
  const totalIgst = roundMoney(
    lines.reduce((s, l) => s + l.igstAmount, 0)
  );
  const totalTax = roundMoney(totalCgst + totalSgst + totalIgst);
  const grandTotal = roundMoney(subTotal + totalTax);
  return { subTotal, totalCgst, totalSgst, totalIgst, totalTax, grandTotal };
}

/** True when the PO was saved with the GST schema (not a legacy fixture). */
export function hasGstBreakdown(po: PurchaseOrder): boolean {
  return (
    typeof po.sub_total === "number" ||
    po.items.some(
      (i) =>
        typeof i.sub_total === "number" ||
        typeof i.cgst_amount === "number" ||
        Boolean(i.hsn_code)
    )
  );
}

export function poSubTotal(po: PurchaseOrder): number {
  if (typeof po.sub_total === "number") return po.sub_total;
  const fromItems = po.items.reduce((s, i) => {
    if (typeof i.sub_total === "number") return s + i.sub_total;
    return s + i.quantity * i.rate;
  }, 0);
  if (fromItems > 0) return roundMoney(fromItems);
  return po.total_amount;
}

export function poGrandTotal(po: PurchaseOrder): number {
  if (typeof po.grand_total === "number") return po.grand_total;
  return po.total_amount;
}

export function itemSubTotal(item: POItem): number {
  if (typeof item.sub_total === "number") return item.sub_total;
  return roundMoney(item.quantity * item.rate);
}

export function itemLineTotal(item: POItem): number {
  if (
    typeof item.cgst_amount === "number" ||
    typeof item.sgst_amount === "number" ||
    typeof item.igst_amount === "number"
  ) {
    return roundMoney(
      itemSubTotal(item) +
        (item.cgst_amount ?? 0) +
        (item.sgst_amount ?? 0) +
        (item.igst_amount ?? 0)
    );
  }
  return item.total;
}
