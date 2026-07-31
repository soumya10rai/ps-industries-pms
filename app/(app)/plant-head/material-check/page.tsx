"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import {
  PART_WEIGHT_GRAMS,
  SCRAP_PERCENT,
  type POMaterialCheck,
} from "@/lib/material-calc";

export default function MaterialCheckPage() {
  const [checks, setChecks] = useState<POMaterialCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procureMsg, setProcureMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/material-calc/calculate", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load material checks.");
      }
      setChecks(Array.isArray(data.checks) ? data.checks : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load material checks."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shortfallCount = checks.reduce(
    (n, c) => n + c.lines.filter((l) => l.status === "shortfall").length,
    0
  );

  return (
    <div className="ps-section">
      <PageHeader
        title="Material Check"
        subtitle={`Live stock from /raw_materials — ${PART_WEIGHT_GRAMS}g/part + ${SCRAP_PERCENT}% scrap. Formula: (g/1000) × qty × (1 + scrap%). Approving a PO with enough stock auto-deducts inventory.`}
        actions={
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-8 sm:grid-cols-3">
        <div className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 shadow-card transition duration-200 ease-in-out hover:shadow-card-hover">
          <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Approved POs
          </p>
          <p className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ps-navy">
            {loading ? "—" : checks.length}
          </p>
        </div>
        <div className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 shadow-card transition duration-200 ease-in-out hover:shadow-card-hover">
          <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Shortfall Lines
          </p>
          <p className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ps-navy">
            {loading ? "—" : shortfallCount}
          </p>
        </div>
        <div className="rounded-lg border-l-4 border-ps-red bg-white px-6 py-4 shadow-card transition duration-200 ease-in-out hover:shadow-card-hover">
          <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
            Part / Scrap
          </p>
          <p className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ps-navy">
            {PART_WEIGHT_GRAMS}g / {SCRAP_PERCENT}%
          </p>
        </div>
      </div>

      {procureMsg && (
        <div className="alert-success" role="status">
          {procureMsg}
        </div>
      )}
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm leading-relaxed text-ps-gray-500">
          Loading approved POs…
        </p>
      ) : checks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ps-navy/30 bg-white px-6 py-16 text-center shadow-card">
          <p className="font-serif text-ps-h2 text-ps-navy">
            No approved POs requiring material check
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ps-gray-500">
            Approve purchase orders on the Approvals page to see material
            requirements here.
          </p>
        </div>
      ) : (
        checks.map((check) => (
          <section
            key={check.po.id}
            className="overflow-hidden rounded-lg border border-ps-gray-200 bg-white shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ps-navy/20 bg-ps-navy px-6 py-4 text-white">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-relaxed">
                <span className="font-serif text-ps-h2 text-white">
                  {check.po.po_number}
                </span>
                <span className="text-blue-100">|</span>
                <span>{check.po.customer_name}</span>
                <span className="text-blue-100">|</span>
                <span>
                  Delivery:{" "}
                  <strong className="font-semibold text-white">
                    {check.po.delivery_date || "—"}
                  </strong>
                </span>
              </div>
              {check.all_stock_available ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-300/40">
                  <CheckIcon /> All stock available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-100 ring-1 ring-inset ring-red-300/40">
                  Shortfall {check.total_shortfall_kg.toLocaleString("en-IN")} kg
                </span>
              )}
            </div>

            <div className="px-6 py-4">
              <p className="mb-4 text-xs leading-relaxed text-ps-gray-500">
                Total required:{" "}
                <strong className="text-ps-navy">
                  {check.total_required_kg.toLocaleString("en-IN")} kg
                </strong>
                {" · "}
                Based on {check.po.items.length} line item
                {check.po.items.length === 1 ? "" : "s"} @ {PART_WEIGHT_GRAMS}g
                + {SCRAP_PERCENT}% scrap
              </p>

              <DataTable
                headers={[
                  "Material",
                  "Required (kg)",
                  "Current Stock (kg)",
                  "Shortfall (kg)",
                  "Status",
                  "Action",
                ]}
              >
                {check.lines.map((line, i) => (
                  <TableRow key={`${check.po.id}-${line.material}`} index={i}>
                    <Td className="font-semibold text-ps-navy">
                      {line.material}
                    </Td>
                    <Td>{line.required_kg.toLocaleString("en-IN")}</Td>
                    <Td>{line.stock_kg.toLocaleString("en-IN")}</Td>
                    <Td
                      className={
                        line.shortfall_kg > 0
                          ? "font-semibold text-ps-red"
                          : "text-emerald-700"
                      }
                    >
                      {line.shortfall_kg > 0
                        ? line.shortfall_kg.toLocaleString("en-IN")
                        : "0"}
                    </Td>
                    <Td>
                      {line.status === "ok" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300">
                          <CheckIcon /> OK
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-900 ring-1 ring-inset ring-red-300">
                          Shortfall
                        </span>
                      )}
                    </Td>
                    <Td>
                      {line.status === "shortfall" ? (
                        <Button
                          onClick={() =>
                            setProcureMsg(
                              `Procure request noted for ${line.material} (${line.shortfall_kg} kg) — PO ${check.po.po_number}.`
                            )
                          }
                          className="!px-4 !py-1.5 text-xs"
                        >
                          Procure
                        </Button>
                      ) : (
                        <span className="text-xs text-ps-gray-400">—</span>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </DataTable>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
