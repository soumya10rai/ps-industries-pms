import type { NextApiRequest, NextApiResponse } from "next";
import { getPOStore } from "@/lib/mock-data";

/**
 * GET /api/po/list — returns current in-memory purchase orders.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({ orders: getPOStore() });
}
