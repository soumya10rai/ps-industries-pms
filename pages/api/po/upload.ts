import type { NextApiRequest, NextApiResponse } from "next";
import { MOCK_POS } from "@/lib/mock-data";
import type { PurchaseOrder } from "@/lib/types";

function matchSample(fileName: string): PurchaseOrder | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("bmr") || lower.includes("4400042956")) {
    return structuredClone(
      MOCK_POS.find((p) => p.po_number === "4400042956-0")!
    );
  }
  if (lower.includes("kent") || lower.includes("426rm0461")) {
    return structuredClone(MOCK_POS.find((p) => p.po_number === "426RM0461")!);
  }
  if (lower.includes("prem") || lower.includes("000612")) {
    return structuredClone(MOCK_POS.find((p) => p.po_number === "000612")!);
  }
  return null;
}

/**
 * POST /api/po/upload
 * Accepts multipart file upload and returns a parsed PO preview.
 * Filenames containing BMR / Kent / Prem map to the sample fixtures.
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

function extractFilename(body: Buffer, contentType: string): string {
  const text = body.toString("latin1");
  const match = /filename="([^"]+)"/i.exec(text);
  if (match?.[1]) return match[1];
  if (contentType.includes("filename=")) {
    const m = /filename="?([^";]+)"?/i.exec(contentType);
    if (m?.[1]) return m[1];
  }
  return "uploaded-po.pdf";
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
    const fileName = extractFilename(raw, contentType);

    let po = matchSample(fileName);

    if (!po) {
      const stamp = Date.now().toString().slice(-6);
      po = {
        id: `po-upload-${stamp}`,
        po_number: `UP-${stamp}`,
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
    } else {
      po = {
        ...po,
        id: `${po.id}-upload-${Date.now()}`,
        status: "pending",
        parse_source: "upload",
        source_file: fileName,
        uploaded_at: new Date().toISOString(),
        approved_by: undefined,
        approved_at: undefined,
        rejection_reason: undefined,
      };
    }

    return res.status(200).json({ po, message: "PO parsed successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return res.status(500).json({ error: message });
  }
}
