import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { ROLE_HOME } from "@/lib/types";

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/auth/login");
  }
  redirect(ROLE_HOME[session.role]);
}
