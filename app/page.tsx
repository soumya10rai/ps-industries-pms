import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeForRole } from "@/lib/auth";
import { getServerSession } from "@/lib/server-auth";

export default async function HomePage() {
  const session = await getServerSession();
  if (session) {
    redirect(getHomeForRole(session.role));
  }

  return (
    <div className="flex min-h-screen flex-col bg-ps-dark">
      <header className="bg-ps-navy px-6 py-4 text-white">
        <p className="font-serif text-xl font-bold tracking-wide">PS INDUSTRIES</p>
        <p className="text-xs text-blue-100">Admin Portal — Greater Noida Plant</p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center text-white">
        <h1 className="font-serif text-4xl font-bold sm:text-5xl">
          PS Industries
        </h1>
        <p className="mt-3 max-w-md text-blue-100">
          Production management for Greater Noida Plant — secure role-based access
          for Admin, Plant Head, Accountant, Store, and Production.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/auth/login"
            className="rounded bg-white px-5 py-2.5 text-sm font-semibold text-ps-navy hover:bg-blue-50"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="rounded border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Register
          </Link>
        </div>
      </main>
      <footer className="bg-ps-navy py-3 text-center text-xs text-blue-100">
        © {new Date().getFullYear()} PS Industries — Greater Noida Plant
      </footer>
    </div>
  );
}
