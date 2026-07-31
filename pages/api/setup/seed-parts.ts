import type { NextApiRequest, NextApiResponse } from "next";
import { seedPartsAndCustomers } from "@/lib/parts";

/**
 * POST /api/setup/seed-parts
 * Seeds Firestore `parts` + `customers` from the hardcoded Kent/BMR/… master.
 * Admin or accountant may call (middleware session required).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const role = String(req.headers["x-user-role"] ?? "").trim();
  if (role !== "admin" && role !== "accountant") {
    return res.status(403).json({
      error: "Only admin or accountant can seed the parts master.",
    });
  }

  try {
    const result = await seedPartsAndCustomers();
    return res.status(200).json({
      ok: true,
      ...result,
      message: `Seeded ${result.partsUpserted} parts and ${result.customersUpserted} customers.`,
    });
  } catch (err) {
    console.error("[setup/seed-parts]", err);
    const message = err instanceof Error ? err.message : "Seed failed.";
    return res.status(500).json({ error: message });
  }
}
