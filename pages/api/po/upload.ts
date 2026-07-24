import type { NextApiRequest, NextApiResponse } from "next";
import { MOCK_POS } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

function matchSample(fileName: string): PurchaseOrder | null {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("bmr") ||
    lower.includes("4400042956") ||
    lower.includes("hvac")
  ) {
    return structuredClone(
      MOCK_POS.find((p) => p.po_number === "4400042956-0")!
    );
  }
  if (
    lower.includes("kent") ||
    lower.includes("426rm0461") ||
    lower.includes("ro_systems") ||
    lower.includes("ro-systems")
  ) {
    return structuredClone(MOCK_POS.find((p) => p.po_number === "426RM0461")!);
  }
  if (lower.includes("prem") || lower.includes("000612")) {
    return structuredClone(MOCK_POS.find((p) => p.po_number === "000612")!);
  }
  return null;
}

function buildPreview(fileName: string): PurchaseOrder {
  const matched = matchSample(fileName);
  const stamp = Date.now();

  if (matched) {
    return {
      ...matched,
      id: `po_${matched.customer_code.toLowerCase()}_${stamp}`,
      status: "pending",
      parse_source: "upload",
      source_file: fileName,
      uploaded_at: new Date().toISOString(),
      approved_by: undefined,
      approved_at: undefined,
      rejection_reason: undefined,
    };
  }

  return {
    id: `po_upload_${stamp}`,
    po_number: `UP-${String(stamp).slice(-6)}`,
    po_date: new Date().toISOString().slice(0, 10),
    customer_code: "NEW",
    customer_name: "Uploaded Customer",
    delivery_date: null,
    payment_terms: "45 Days",
    items: [
      {
        item_code: "ITEM-001",
        description: "Parsed line item from upload",
        part_code: null,
        quantity: 1000,
        uom: "NOS",
        rate: 10,
        total: 10000,
        material_grade: null,
        colour: null,
      },
    ],
    total_amount: 10000,
    gst: "CGST 9% + SGST 9%",
    status: "pending",
    parse_source: "upload",
    source_file: fileName,
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * POST /api/po/upload
 *
 * Accepts either:
 * - multipart/form-data with `file` (PDF/Excel)
 * - application/json `{ filename: "BMR_....pdf" }`
 *
 * Filenames containing BMR / Kent / Prem map to the 3 sample fixtures.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function extractFilenameFromMultipart(
  body: Buffer,
  contentType: string
): string | null {
  const text = body.toString("latin1");
  const match = /filename\*?=(?:UTF-8''|")?([^\";\r\n]+)"?/i.exec(text);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"/g, "").trim());
    } catch {
      return match[1].replace(/"/g, "").trim();
    }
  }
  if (contentType.includes("filename=")) {
    const m = /filename="?([^";]+)"?/i.exec(contentType);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const raw = await readRawBody(req);
    let fileName = "uploaded-po.pdf";

    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw.toString("utf8") || "{}") as {
        filename?: string;
        fileName?: string;
        name?: string;
      };
      fileName =
        parsed.filename || parsed.fileName || parsed.name || fileName;
    } else if (contentType.includes("multipart/form-data")) {
      fileName =
        extractFilenameFromMultipart(raw, contentType) || fileName;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw.toString("utf8"));
      fileName =
        params.get("filename") ||
        params.get("fileName") ||
        params.get("name") ||
        fileName;
    }

    fileName = fileName.trim() || "uploaded-po.pdf";
    const po = buildPreview(fileName);
    const matched = Boolean(matchSample(fileName));

    return res.status(200).json({
      ok: true,
      po,
      matched,
      message: matched
        ? `Matched sample PO ${po.po_number} from filename "${fileName}".`
        : `Parsed generic preview from "${fileName}". Name file with BMR, Kent, or Prem for fixtures.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return res.status(500).json({ error: message });
  }
}
