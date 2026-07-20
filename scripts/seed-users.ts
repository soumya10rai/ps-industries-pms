/**
 * CLI seed helper — same sample users as POST /api/auth/seed.
 *
 * Usage:
 *   1. Copy .env.example → .env.local and fill Firebase Admin + SEED_SECRET
 *   2. npm run seed
 *
 * Or via HTTP once the app is running:
 *   curl -X POST http://localhost:3000/api/auth/seed \
 *     -H "x-seed-secret: $SEED_SECRET" \
 *     -H "Content-Type: application/json"
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const base =
    process.env.SEED_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const secret = process.env.SEED_SECRET;

  if (!secret) {
    console.error("SEED_SECRET is required in .env.local");
    process.exit(1);
  }

  const res = await fetch(`${base}/api/auth/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-seed-secret": secret,
    },
    body: "{}",
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Seed failed:", data);
    process.exit(1);
  }

  console.log("Seed OK:", JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
