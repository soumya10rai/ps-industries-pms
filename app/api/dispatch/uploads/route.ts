import { NextRequest, NextResponse } from "next/server";
import {
  canReadDispatch,
  canWriteDispatch,
  getDispatchSession,
} from "@/lib/dispatch-auth";
import {
  deleteDispatchUpload,
  listDispatchUploads,
} from "@/lib/dispatch";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/uploads — upload history
 */
export async function GET(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canReadDispatch(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const uploads = await listDispatchUploads();
    return NextResponse.json({ success: true, uploads });
  } catch (err) {
    console.error("[dispatch/uploads GET]", err);
    const message =
      err instanceof Error ? err.message : "Failed to load uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/dispatch/uploads?uploadId=
 */
export async function DELETE(request: NextRequest) {
  const session = await getDispatchSession(request);
  if (!session || !canWriteDispatch(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const uploadId =
      request.nextUrl.searchParams.get("uploadId")?.trim() || "";
    if (!uploadId) {
      return NextResponse.json(
        { error: "uploadId is required." },
        { status: 400 }
      );
    }

    const result = await deleteDispatchUpload(uploadId);
    return NextResponse.json({
      success: true,
      uploadId,
      deletedItems: result.deletedItems,
    });
  } catch (err) {
    console.error("[dispatch/uploads DELETE]", err);
    const message =
      err instanceof Error ? err.message : "Failed to delete upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
