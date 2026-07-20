import { redirect } from "next/navigation";
import { AuthNavbar } from "@/components/AuthNavbar";
import { getServerSession } from "@/lib/server-auth";

/**
 * Shared shell for all role-gated dashboards under (protected).
 * Middleware is the primary gate; this layout is defense-in-depth.
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerSession();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <>
      <AuthNavbar user={user} />
      <main>{children}</main>
    </>
  );
}
