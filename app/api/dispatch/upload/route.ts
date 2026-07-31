import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  canWriteDispatch,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import { parseDispatchExcel } from "@/lib/dispatch-parser";
import {
  clearPreviousLatest,
  dispatchDb,
  saveDispatchItems,
} from "@/lib/dispatch";
import { DISPATCH_PLANTS } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/dispatch/upload
 * multipart: file + periodStart + periodEnd + plant
 */
export async function POST(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canWriteDispatch(session.role)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. accountant, plant_head, or admin required.",
      },
      { status: 401 }
    );
  }

  let uploadId = "";
  const db = dispatchDb();

  try {
    const form = await request.formData();
    const file = form.get("file");
    const plant = String(form.get("plant") ?? "All").trim() || "All";
    const periodStart = String(form.get("periodStart") ?? "").trim();
    const periodEnd = String(form.get("periodEnd") ?? "").trim();

    if (!(DISPATCH_PLANTS as readonly string[]).includes(plant)) {
      return NextResponse.json(
        {
          error: `Invalid plant. Use one of: ${DISPATCH_PLANTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Excel file is required (field name: file)." },
        { status: 400 }
      );
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const fileName = file.name || "dispatch.xlsx";
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadRef = db.collection("dispatch_uploads").doc();
    uploadId = uploadRef.id;

    await uploadRef.set({
      uploadId,
      fileName,
      uploadedBy: session.uid,
      uploadedAt: FieldValue.serverTimestamp(),
      periodStart,
      periodEnd,
      totalItems: 0,
      isLatest: false,
      plant,
      status: "processing",
    });

    const parsed = parseDispatchExcel(buffer, {
      plant,
      fileName,
    });

    if (parsed.dispatches.length === 0) {
      await uploadRef.set(
        {
          status: "failed",
          warnings: parsed.warnings,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json(
        {
          error: "No valid dispatch rows found in Excel.",
          warnings: parsed.warnings,
          uploadId,
        },
        { status: 400 }
      );
    }

    await saveDispatchItems({
      uploadId,
      items: parsed.dispatches,
      periodStart,
      periodEnd,
    });

    await clearPreviousLatest(plant, uploadId);

    await uploadRef.set(
      {
        status: "complete",
        isLatest: true,
        totalItems: parsed.dispatches.length,
        warnings: parsed.warnings,
        plants: parsed.summary.plants,
        customers: parsed.summary.customers,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      uploadId,
      summary: {
        total: parsed.summary.total,
        shortfallCount: parsed.summary.shortfallCount,
        excessCount: parsed.summary.excessCount,
        onTrackCount: parsed.summary.onTrackCount,
        completeCount: parsed.summary.completeCount,
        plants: parsed.summary.plants,
        customers: parsed.summary.customers,
      },
      warnings: parsed.warnings,
    });
  } catch (err) {
    console.error("[dispatch/upload]", err);
    if (uploadId) {
      try {
        await db.collection("dispatch_uploads").doc(uploadId).set(
          {
            status: "failed",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }
    }
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
