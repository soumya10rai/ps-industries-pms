import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-auth";

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
    <AppShell
      user={{
        email: user.email,
        role: user.role,
        displayName: user.displayName || user.email.split("@")[0],
      }}
    >
      {children}
    </AppShell>
  );
}
