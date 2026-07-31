import type { NextApiRequest, NextApiResponse } from "next";
import { listCustomers, listParts, countParts } from "@/lib/parts";

/**
 * GET /api/setup/parts?customer=KENT
 * GET /api/setup/parts?count=1  → { count }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (String(req.query.count ?? "") === "1") {
      const count = await countParts();
      return res.status(200).json({ ok: true, count, empty: count === 0 });
    }

    const customer = String(req.query.customer ?? "").trim();
    const parts = await listParts(
      customer ? { customerCode: customer } : undefined
    );
    return res.status(200).json({
      ok: true,
      count: parts.length,
      parts,
    });
  } catch (err) {
    console.error("[setup/parts]", err);
    const message = err instanceof Error ? err.message : "Failed to load parts.";
    return res.status(500).json({ error: message });
  }
}
