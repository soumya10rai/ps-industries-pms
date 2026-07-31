import type { NextApiRequest, NextApiResponse } from "next";
import { uploadPoPdf } from "@/lib/storage";
import Busboy from "busboy";

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedUpload {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

function parseMultipart(req: NextApiRequest): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("multipart/form-data")) {
      reject(new Error("Expected multipart/form-data with a PDF file."));
      return;
    }

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: 20 * 1024 * 1024 },
    });

    let fileName = "";
    let mimeType = "application/pdf";
    const chunks: Buffer[] = [];
    let sawFile = false;
    let truncated = false;

    busboy.on(
      "file",
      (
        _name: string,
        stream: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string }
      ) => {
        sawFile = true;
        fileName = info.filename || "po.pdf";
        mimeType = info.mimeType || "application/pdf";
        stream.on("data", (d: Buffer) => chunks.push(d));
        stream.on("limit", () => {
          truncated = true;
        });
      }
    );

    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (truncated) {
        reject(new Error("PDF exceeds the 20 MB upload limit."));
        return;
      }
      if (!sawFile || chunks.length === 0) {
        reject(new Error("PDF file is required (field name: file)."));
        return;
      }
      resolve({
        fileName,
        mimeType,
        buffer: Buffer.concat(chunks),
      });
    });

    req.pipe(busboy);
  });
}

/**
 * POST /api/po/upload
 * Accepts multipart PDF → stores in Firebase Storage → returns URL only.
 * Does NOT create a purchase-order document.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uploaded = await parseMultipart(req);
    const lower = uploaded.fileName.toLowerCase();
    if (!lower.endsWith(".pdf") && uploaded.mimeType !== "application/pdf") {
      return res.status(400).json({
        error: "Only PDF files are accepted for PO record-keeping.",
      });
    }

    const result = await uploadPoPdf({
      buffer: uploaded.buffer,
      fileName: uploaded.fileName.endsWith(".pdf")
        ? uploaded.fileName
        : `${uploaded.fileName}.pdf`,
      contentType: "application/pdf",
    });

    return res.status(200).json({
      ok: true,
      pdfUrl: result.pdfUrl,
      storagePath: result.storagePath,
      fileName: result.fileName,
      sizeBytes: uploaded.buffer.length,
    });
  } catch (err) {
    console.error("[po/upload]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return res.status(500).json({ error: message });
  }
}
