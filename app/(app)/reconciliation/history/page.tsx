import { getServerSession } from "@/lib/server-auth";
import ReconciliationHistoryClient from "./HistoryClient";

export default async function ReconciliationHistoryPage() {
  const session = await getServerSession();
  return <ReconciliationHistoryClient serverRole={session?.role ?? null} />;
}
