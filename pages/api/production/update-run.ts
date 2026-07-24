import type { NextApiRequest, NextApiResponse } from "next";
import { findRun, upsertRun } from "@/lib/mock-data";
import type { ProductionRun } from "@/lib/types";

const ALLOWED_STATUS: ProductionRun["status"][] = [
  "scheduled",
  "running",
  "paused",
  "completed",
];

/**
 * POST /api/production/update-run
 * Body: { id | run_number, status?, completed?, machine? }
 *
 * Updates progress / status of an existing production run.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const key = String(req.body?.id ?? req.body?.run_number ?? "").trim();
    if (!key) {
      return res.status(400).json({ error: "Provide id or run_number." });
    }

    const existing = findRun(key);
    if (!existing) {
      return res.status(404).json({ error: "Production run not found." });
    }

    let status = existing.status;
    if (req.body?.status !== undefined) {
      const next = String(req.body.status) as ProductionRun["status"];
      if (!ALLOWED_STATUS.includes(next)) {
        return res.status(400).json({
          error: `Invalid status. Use: ${ALLOWED_STATUS.join(", ")}`,
        });
      }
      status = next;
    }

    let completed = existing.completed;
    if (req.body?.completed !== undefined) {
      completed = Number(req.body.completed);
      if (Number.isNaN(completed) || completed < 0) {
        return res.status(400).json({ error: "completed must be >= 0." });
      }
      completed = Math.min(completed, existing.quantity);
    }

    if (status === "completed") {
      completed = existing.quantity;
    }

    const machine =
      req.body?.machine !== undefined
        ? String(req.body.machine).trim() || existing.machine
        : existing.machine;

    let started_at = existing.started_at;
    if (status === "running" && !started_at) {
      started_at = new Date().toISOString();
    }

    const updated = upsertRun({
      ...existing,
      status,
      completed,
      machine,
      started_at,
    });

    return res.status(200).json({
      run: updated,
      message: `Run ${updated.run_number} updated.`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update production run.";
    return res.status(500).json({ error: message });
  }
}
