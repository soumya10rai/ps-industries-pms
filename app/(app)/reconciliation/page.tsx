"use client";

import { Suspense } from "react";
import ReconciliationClient from "./ReconciliationClient";

export default function ReconciliationPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-ps-gray-500">Loading reconciliation…</p>
      }
    >
      <ReconciliationClient />
    </Suspense>
  );
}
