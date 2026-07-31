import type { NextApiRequest, NextApiResponse } from "next";
import { listCustomers } from "@/lib/parts";
import { DEFAULT_CUSTOMERS } from "@/lib/types";

/**
 * GET /api/setup/customers
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
    const customers = await listCustomers();
    return res.status(200).json({
      ok: true,
      count: customers.length,
      customers: customers.length ? customers : DEFAULT_CUSTOMERS,
    });
  } catch (err) {
    console.error("[setup/customers]", err);
    return res.status(200).json({
      ok: true,
      count: DEFAULT_CUSTOMERS.length,
      customers: DEFAULT_CUSTOMERS,
      warning: "Falling back to default customers.",
    });
  }
}
