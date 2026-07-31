/**
 * Dispatch variance PDF — navy section bands, alternating grey rows,
 * green/red status colors, PS Industries footer.
 */

import PDFDocument from "pdfkit";
import type { DispatchItem } from "@/lib/types";
import type { VarianceReport } from "@/lib/dispatch";

const NAVY = "#1B2A4A";
const RED = "#C41E3A";
const GREEN = "#1B7A4E";
const AMBER = "#B45309";
const GREY_ROW = "#F3F4F6";
const LIGHT_BAND = "#E8EEF7";
const MUTED = "#6B7280";

export interface DispatchPdfInput {
  report: VarianceReport;
  periodStart: string;
  periodEnd: string;
  plant?: string;
  fileName?: string;
  generatedAt?: Date;
}

function statusColor(status: string): string {
  switch (status) {
    case "shortfall":
      return RED;
    case "excess":
      return AMBER;
    case "on_track":
    case "complete":
      return GREEN;
    default:
      return MUTED;
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

/**
 * Build a PDF buffer for the variance report.
 */
export async function buildDispatchVariancePdf(
  input: DispatchPdfInput
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    info: {
      Title: "PS Industries — Dispatch Variance Report",
      Author: "PS Industries PMS",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const { report, periodStart, periodEnd } = input;
  const left = doc.page.margins.left;
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 24;
  const rowH = 15;

  const ensure = (needed: number) => {
    if (doc.y + needed > bottomLimit()) {
      doc.addPage();
    }
  };

  // —— Title band ——
  doc.rect(0, 0, doc.page.width, 64).fill(NAVY);
  doc
    .fillColor("#FFFFFF")
    .fontSize(15)
    .font("Helvetica-Bold")
    .text("PS Industries", left, 16, { width: pageWidth, lineBreak: false });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Dispatch Variance Report", left, 38, {
      width: pageWidth,
      lineBreak: false,
    });
  doc.y = 76;

  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Period: ${periodStart} → ${periodEnd}` +
        (input.plant && input.plant !== "All"
          ? `  ·  Plant: ${input.plant}`
          : "  ·  All plants") +
        (input.fileName ? `  ·  Source: ${input.fileName}` : ""),
      left,
      doc.y,
      { width: pageWidth }
    );
  doc.text(
    `Generated: ${(input.generatedAt ?? new Date()).toLocaleString("en-IN")}`,
    left,
    doc.y + 2,
    { width: pageWidth }
  );
  doc.moveDown(0.6);

  // —— KPIs ——
  sectionBand(doc, "Summary", pageWidth, left, ensure);
  const kpiY = doc.y;
  const kpiW = pageWidth / 4;
  const kpis = [
    { label: "Planned", value: fmt(report.totalPlanned), color: NAVY },
    { label: "Dispatched", value: fmt(report.totalDispatched), color: NAVY },
    {
      label: "Variance",
      value: `${report.totalVariance >= 0 ? "+" : ""}${fmt(report.totalVariance)}`,
      color: report.totalVariance < 0 ? RED : GREEN,
    },
    {
      label: "Variance %",
      value: fmtPct(report.totalVariancePercent),
      color: report.totalVariancePercent < 0 ? RED : GREEN,
    },
  ];
  kpis.forEach((k, i) => {
    const x = left + i * kpiW;
    doc.fontSize(7).fillColor(MUTED).text(k.label.toUpperCase(), x, kpiY, {
      width: kpiW - 6,
      lineBreak: false,
    });
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .fillColor(k.color)
      .text(k.value, x, kpiY + 12, { width: kpiW - 6, lineBreak: false });
    doc.font("Helvetica");
  });
  doc.y = kpiY + 36;

  const sc = report.statusCounts;
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Status: ${sc.complete} complete · ${sc.on_track} on track · ${sc.shortfall} shortfall · ${sc.excess} excess`,
      left,
      doc.y,
      { width: pageWidth }
    );
  doc.moveDown(0.7);

  // —— By plant ——
  sectionBand(doc, "Breakdown by Plant", pageWidth, left, ensure);
  drawTable(
    doc,
    {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: ["Plant", "Planned", "Dispatched", "Variance"],
      widths: [0.34, 0.22, 0.22, 0.22],
      rows: report.byPlant.map((r) => [
        r.plant,
        fmt(r.planned),
        fmt(r.dispatched),
        `${r.variance >= 0 ? "+" : ""}${fmt(r.variance)}`,
      ]),
      colorFor: (row) => (String(row[3]).startsWith("-") ? RED : GREEN),
    }
  );

  sectionBand(doc, "Breakdown by Customer", pageWidth, left, ensure);
  drawTable(
    doc,
    {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: ["Customer", "Planned", "Dispatched", "Variance", "Shortfalls"],
      widths: [0.32, 0.17, 0.17, 0.17, 0.17],
      rows: report.byCustomer.map((r) => [
        truncate(r.customer, 28),
        fmt(r.planned),
        fmt(r.dispatched),
        `${r.variance >= 0 ? "+" : ""}${fmt(r.variance)}`,
        String(r.shortfallCount),
      ]),
      colorFor: (row) => (String(row[3]).startsWith("-") ? RED : GREEN),
    }
  );

  sectionBand(doc, "Top 10 Largest Shortfalls", pageWidth, left, ensure);
  if (report.shortfalls.length === 0) {
    doc.fontSize(8).fillColor(MUTED).text("No shortfalls in this period.", left);
    doc.moveDown(0.5);
  } else {
    drawTable(
      doc,
      {
        left,
        pageWidth,
        rowH,
        ensure,
        headers: ["Item", "Plant", "Planned", "Actual", "Variance", "%"],
        widths: [0.38, 0.16, 0.12, 0.12, 0.12, 0.1],
        rows: report.shortfalls.map((r) => [
          `${r.itemCode} ${truncate(r.itemDescription, 22)}`,
          r.plant,
          fmt(r.plannedQuantity),
          fmt(r.actualQuantity),
          fmt(r.variance),
          fmtPct(r.variancePercent),
        ]),
        colorFor: () => RED,
      }
    );
  }

  sectionBand(doc, "All Dispatches", pageWidth, left, ensure);
  drawTable(
    doc,
    {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: [
        "Customer",
        "Code",
        "Description",
        "Plant",
        "Plan",
        "Actual",
        "Var",
        "%",
        "Status",
      ],
      widths: [0.14, 0.09, 0.22, 0.12, 0.08, 0.08, 0.08, 0.07, 0.12],
      rows: report.items.map((r: DispatchItem) => [
        truncate(r.customer, 14),
        r.itemCode,
        truncate(r.itemDescription, 24),
        r.plant,
        fmt(r.plannedQuantity),
        fmt(r.actualQuantity),
        `${r.variance >= 0 ? "+" : ""}${fmt(r.variance)}`,
        fmtPct(r.variancePercent),
        fmtStatus(r.status),
      ]),
      colorFor: (row) =>
        statusColor(row[8]!.toLowerCase().replace(/ /g, "_")),
    }
  );

  // Footers on every buffered page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `PS Industries — Dispatch Variance Report | Page ${i + 1} of ${range.count}`,
        left,
        doc.page.height - 32,
        { width: pageWidth, align: "center", lineBreak: false }
      );
  }

  doc.end();
  return done;
}

function sectionBand(
  doc: PDFKit.PDFDocument,
  title: string,
  pageWidth: number,
  left: number,
  ensure: (n: number) => void
): void {
  ensure(28);
  const y = doc.y;
  doc.rect(left, y, pageWidth, 16).fill(NAVY);
  doc
    .fillColor("#FFFFFF")
    .fontSize(8)
    .font("Helvetica-Bold")
    .text(title.toUpperCase(), left + 6, y + 4, {
      width: pageWidth - 12,
      lineBreak: false,
    });
  doc.font("Helvetica");
  doc.y = y + 22;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  opts: {
    left: number;
    pageWidth: number;
    rowH: number;
    ensure: (n: number) => void;
    headers: string[];
    widths: number[];
    rows: string[][];
    colorFor?: (row: string[]) => string;
  }
): void {
  const colWidths = opts.widths.map((w) => w * opts.pageWidth);
  let headerDrawnOnPage = false;
  let lastPage = doc.bufferedPageRange().count;

  const paintHeader = () => {
    opts.ensure(opts.rowH + 2);
    const y = doc.y;
    doc.rect(opts.left, y, opts.pageWidth, opts.rowH).fill(LIGHT_BAND);
    let x = opts.left;
    opts.headers.forEach((h, i) => {
      doc
        .fontSize(6.5)
        .font("Helvetica-Bold")
        .fillColor(NAVY)
        .text(h.toUpperCase(), x + 2, y + 4, {
          width: colWidths[i]! - 4,
          lineBreak: false,
        });
      x += colWidths[i]!;
    });
    doc.font("Helvetica");
    doc.y = y + opts.rowH;
    headerDrawnOnPage = true;
  };

  paintHeader();

  for (let idx = 0; idx < opts.rows.length; idx++) {
    const pageCount = doc.bufferedPageRange().count;
    if (pageCount !== lastPage) {
      lastPage = pageCount;
      headerDrawnOnPage = false;
    }
    if (!headerDrawnOnPage) paintHeader();

    opts.ensure(opts.rowH + 1);
    // If ensure flipped the page, redraw header first.
    if (doc.bufferedPageRange().count !== lastPage) {
      lastPage = doc.bufferedPageRange().count;
      headerDrawnOnPage = false;
      paintHeader();
    }

    const row = opts.rows[idx]!;
    const y = doc.y;
    if (idx % 2 === 1) {
      doc.rect(opts.left, y, opts.pageWidth, opts.rowH).fill(GREY_ROW);
    }
    let x = opts.left;
    const color = opts.colorFor?.(row) ?? NAVY;
    row.forEach((cell, i) => {
      doc
        .fontSize(6.5)
        .fillColor(i === 0 ? NAVY : color)
        .text(cell, x + 2, y + 4, {
          width: colWidths[i]! - 4,
          lineBreak: false,
        });
      x += colWidths[i]!;
    });
    doc.y = y + opts.rowH;
  }
  doc.moveDown(0.4);
}
