import Link from "next/link";
import { getServerSession } from "@/lib/server-auth";
import { ROLE_HOME } from "@/lib/types";
import { redirect } from "next/navigation";

/**
 * Public landing. Authenticated users are sent to their role home
 * (also enforced in middleware).
 */
export default async function HomePage() {
  const session = await getServerSession();
  if (session) {
    redirect(ROLE_HOME[session.role]);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-steel-50 via-white to-brand-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(15, 76, 129, 0.12), transparent 45%), radial-gradient(circle at 80% 0%, rgba(15, 76, 129, 0.08), transparent 40%)",
        }}
      />
      <header className="relative z-10 mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <p className="font-display text-lg font-semibold tracking-tight text-steel-900">
          PS Industries
        </p>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/auth/login"
            className="text-steel-600 transition hover:text-brand-700"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="rounded-md bg-brand-700 px-3 py-1.5 font-medium text-white transition hover:bg-brand-800"
          >
            Register
          </Link>
        </nav>
      </header>
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col justify-center px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <h1 className="font-display max-w-2xl text-4xl font-semibold tracking-tight text-steel-900 sm:text-5xl">
          Production management for the plant floor.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-steel-600">
          Secure, role-based access for admins, plant heads, store, production,
          and finance.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth/login"
            className="rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            Sign in to continue
          </Link>
          <Link
            href="/auth/register"
            className="rounded-md border border-steel-200 bg-white/80 px-5 py-2.5 text-sm font-medium text-steel-700 transition hover:border-steel-300 hover:bg-white"
          >
            Request access
          </Link>
        </div>
      </main>
    </div>
  );
}
