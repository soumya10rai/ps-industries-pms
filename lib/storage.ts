/**
 * Upload a PDF buffer to Firebase Storage under po_pdfs/.
 * Returns a downloadable URL (token-based Firebase Storage URL).
 */

import { randomUUID } from "node:crypto";
import { getAdminStorage } from "@/lib/firebase-admin";

export async function uploadPoPdf(opts: {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
}): Promise<{ storagePath: string; pdfUrl: string; fileName: string }> {
  const bucketName =
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error(
      "Storage bucket not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, or skip the PDF and enter the PO manually."
    );
  }

  const bucket = getAdminStorage().bucket(bucketName);
  const safeName = opts.fileName
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  const storagePath = `po_pdfs/${Date.now()}_${safeName}`;
  const token = randomUUID();
  const contentType = opts.contentType || "application/pdf";

  try {
    const file = bucket.file(storagePath);
    await file.save(opts.buffer, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage upload failed";
    if (/bucket does not exist/i.test(msg)) {
      throw new Error(
        `Firebase Storage bucket "${bucketName}" does not exist. Create it in the Firebase console, or skip the PDF and enter the PO manually.`
      );
    }
    throw err;
  }

  const pdfUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

  return { storagePath, pdfUrl, fileName: safeName };
}
