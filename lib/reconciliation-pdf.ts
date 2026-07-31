/**
 * Reconciliation PDF — navy section bands, alternating grey rows,
 * green/amber/red status colors (matches dispatch/June PDF styling).
 */

import PDFDocument from "pdfkit";
import type {
  MaterialVariance,
  ReconciliationReport,
  ReconciliationStatus,
} from "@/lib/types";

const NAVY = "#1B2A4A";
const RED = "#C41E3A";
const GREEN = "#1B7A4E";
const AMBER = "#B45309";
const GREY_ROW = "#F3F4F6";
const LIGHT_BAND = "#E8EEF7";
const MUTED = "#6B7280";

export interface ReconciliationPdfInput {
  report: ReconciliationReport;
  generatedAt?: Date;
}

function statusColor(status: ReconciliationStatus | string): string {
  switch (status) {
    case "alert":
      return RED;
    case "attention":
      return AMBER;
    case "healthy":
      return GREEN;
    default:
      return MUTED;
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(n);
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

function verdictLine(report: ReconciliationReport): string {
  if (report.materialsAnalyzed === 0) {
    return "No materials analyzed for this period.";
  }
  if (report.alertCount > 0) {
    return `${report.alertCount} material${report.alertCount === 1 ? "" : "s"} have ≥15% variance requiring attention.`;
  }
  if (report.attentionCount > 0) {
    return `${report.attentionCount} material${report.attentionCount === 1 ? "" : "s"} need review (5–15% variance).`;
  }
  return "All analyzed materials are within healthy variance (±5%).";
}

/**
 * Build a PDF buffer for a reconciliation report.
 */
export async function buildReconciliationPdf(
  input: ReconciliationPdfInput
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    info: {
      Title: "PS Industries — Reconciliation Report",
      Author: "PS Industries PMS",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const { report } = input;
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

  // —— Cover / title band ——
  doc.rect(0, 0, doc.page.width, 72).fill(NAVY);
  doc
    .fillColor("#FFFFFF")
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("PS Industries", left, 16, { width: pageWidth, lineBreak: false });
  doc
    .fontSize(11)
    .font("Helvetica")
    .text("Reconciliation Report", left, 40, {
      width: pageWidth,
      lineBreak: false,
    });
  doc.y = 86;

  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Period: ${report.periodStart} → ${report.periodEnd}` +
        (report.plant && report.plant !== "All"
          ? `  ·  Plant: ${report.plant}`
          : "  ·  All plants") +
        `  ·  Mode: ${report.mode}`,
      left,
      doc.y,
      { width: pageWidth }
    );
  doc.text(
    `Generated: ${(input.generatedAt ?? new Date(report.generatedAt || Date.now())).toLocaleString("en-IN")}` +
      (report.generatedByName || report.generatedBy
        ? `  ·  By: ${report.generatedByName || report.generatedBy}`
        : ""),
    left,
    doc.y + 2,
    { width: pageWidth }
  );
  doc.moveDown(0.6);

  // —— Executive summary ——
  sectionBand(doc, "Executive Summary", pageWidth, left, ensure);
  const kpiY = doc.y;
  const kpiW = pageWidth / 4;
  const overallStatus = statusColor(
    Math.abs(report.totalVariancePercent) >= 15
      ? "alert"
      : Math.abs(report.totalVariancePercent) >= 5
        ? "attention"
        : "healthy"
  );
  const kpis = [
    { label: "Expected", value: `${fmt(report.totalExpectedKg)} kg`, color: NAVY },
    { label: "Actual", value: `${fmt(report.totalActualKg)} kg`, color: NAVY },
    {
      label: "Net Variance",
      value: `${report.totalVarianceKg >= 0 ? "+" : ""}${fmt(report.totalVarianceKg)} kg`,
      color: overallStatus,
    },
    {
      label: "Variance %",
      value: fmtPct(report.totalVariancePercent),
      color: overallStatus,
    },
  ];
  kpis.forEach((k, i) => {
    const x = left + i * kpiW;
    doc.fontSize(7).fillColor(MUTED).text(k.label.toUpperCase(), x, kpiY, {
      width: kpiW - 6,
      lineBreak: false,
    });
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(k.color)
      .text(k.value, x, kpiY + 12, { width: kpiW - 6, lineBreak: false });
    doc.font("Helvetica");
  });
  doc.y = kpiY + 36;

  doc
    .fontSize(9)
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .text(verdictLine(report), left, doc.y, { width: pageWidth });
  doc.font("Helvetica");
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Materials: ${report.materialsAnalyzed} analyzed · ${report.healthyCount} healthy · ${report.attentionCount} attention · ${report.alertCount} alert` +
        (report.unmappedCount
          ? ` · ${report.unmappedCount} unmapped`
          : ""),
      left,
      doc.y + 4,
      { width: pageWidth }
    );
  doc.moveDown(0.8);

  // —— Material group breakdown ——
  sectionBand(doc, "Material Group Breakdown", pageWidth, left, ensure);
  if (report.summary.byMaterialGroup.length === 0) {
    doc.fontSize(8).fillColor(MUTED).text("No data for this period.", left);
    doc.moveDown(0.5);
  } else {
    drawTable(doc, {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: ["Group", "Expected (kg)", "Actual (kg)", "Variance", "%", "Status"],
      widths: [0.2, 0.18, 0.18, 0.16, 0.12, 0.16],
      rows: report.summary.byMaterialGroup.map((r) => [
        r.materialGroup,
        fmt(r.expectedKg),
        fmt(r.actualKg),
        `${r.varianceKg >= 0 ? "+" : ""}${fmt(r.varianceKg)}`,
        fmtPct(r.variancePercent),
        fmtStatus(r.status),
      ]),
      colorFor: (row) => statusColor(row[5]!.toLowerCase()),
    });
  }

  // —— Top losses ——
  sectionBand(doc, "Top Losses", pageWidth, left, ensure);
  if (report.summary.topLosses.length === 0) {
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text("No positive variance (losses) in this period.", left);
    doc.moveDown(0.5);
  } else {
    drawTable(doc, {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: ["Material", "Group", "Expected", "Actual", "Variance", "%"],
      widths: [0.28, 0.14, 0.14, 0.14, 0.16, 0.14],
      rows: report.summary.topLosses.map((r) => [
        truncate(`${r.materialCode} ${r.materialName}`, 32),
        r.materialGroup,
        fmt(r.expectedKg),
        fmt(r.actualKg),
        `+${fmt(r.varianceKg)}`,
        fmtPct(r.variancePercent),
      ]),
      colorFor: () => RED,
    });
  }

  // —— All materials ——
  sectionBand(doc, "Materials Table", pageWidth, left, ensure);
  if (report.summary.byMaterial.length === 0) {
    doc.fontSize(8).fillColor(MUTED).text("No materials analyzed.", left);
    doc.moveDown(0.5);
  } else {
    drawTable(doc, {
      left,
      pageWidth,
      rowH,
      ensure,
      headers: [
        "Material",
        "Group",
        "Expected",
        "Actual",
        "Var (kg)",
        "%",
        "Status",
      ],
      widths: [0.26, 0.12, 0.12, 0.12, 0.12, 0.1, 0.16],
      rows: report.summary.byMaterial.map((r: MaterialVariance) => [
        truncate(r.materialCode, 22),
        truncate(r.materialGroup, 10),
        fmt(r.expectedKg),
        fmt(r.actualKg),
        `${r.varianceKg >= 0 ? "+" : ""}${fmt(r.varianceKg)}`,
        fmtPct(r.variancePercent),
        fmtStatus(r.status),
      ]),
      colorFor: (row) => statusColor(row[6]!.toLowerCase()),
    });
  }

  // —— Appendix: alert movement log ——
  const alertMaterials = report.summary.byMaterial.filter(
    (m) => m.status === "alert"
  );
  sectionBand(doc, "Appendix — Alert Movement Log", pageWidth, left, ensure);
  if (alertMaterials.length === 0) {
    doc.fontSize(8).fillColor(MUTED).text("No alert materials.", left);
    doc.moveDown(0.5);
  } else {
    for (const mat of alertMaterials) {
      ensure(40);
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(NAVY)
        .text(
          `${mat.materialCode} — ${mat.materialName} (${fmtPct(mat.variancePercent)})`,
          left,
          doc.y,
          { width: pageWidth }
        );
      doc.font("Helvetica");

      if (mat.movements.length === 0) {
        doc
          .fontSize(7)
          .fillColor(MUTED)
          .text("  No ledger movements in period.", left);
        doc.moveDown(0.3);
        continue;
      }

      drawTable(doc, {
        left,
        pageWidth,
        rowH: 13,
        ensure,
        headers: ["Date", "Type", "Qty (kg)", "Reason", "Reference"],
        widths: [0.22, 0.14, 0.12, 0.32, 0.2],
        rows: mat.movements.map((mv) => [
          truncate(mv.date.slice(0, 19).replace("T", " "), 19),
          mv.type,
          fmt(mv.quantityKg),
          truncate(mv.reason || "—", 28),
          truncate(mv.referenceId || "—", 16),
        ]),
        colorFor: () => NAVY,
      });
    }
  }

  // Footers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `PS Industries — Reconciliation Report | Page ${i + 1} of ${range.count}`,
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
