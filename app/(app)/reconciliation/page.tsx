import { Suspense } from "react";
import { getServerSession } from "@/lib/server-auth";
import ReconciliationClient from "./ReconciliationClient";

export default async function ReconciliationPage() {
  const session = await getServerSession();

  return (
    <Suspense
      fallback={
        <p className="text-sm text-ps-gray-500">Loading reconciliation…</p>
      }
    >
      <ReconciliationClient serverRole={session?.role ?? null} />
    </Suspense>
  );
}
