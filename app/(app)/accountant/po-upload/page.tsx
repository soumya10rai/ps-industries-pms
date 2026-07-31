"use client";

import { Suspense } from "react";
import POUploadForm from "./POUploadForm";

export default function POUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="ps-section">
          <p className="text-sm text-ps-gray-500">Loading PO form…</p>
        </div>
      }
    >
      <POUploadForm />
    </Suspense>
  );
}
