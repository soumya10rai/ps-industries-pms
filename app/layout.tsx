import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import { AuthNavbar } from "@/components/AuthNavbar";
import { getServerSession } from "@/lib/server-auth";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PS Industries | Production Management",
  description:
    "Production management system for PS Industries — secure role-based access.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerSession();

  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${outfit.variable} font-sans antialiased`}
      >
        <AuthNavbar user={user} />
        <main>{children}</main>
      </body>
    </html>
  );
}
