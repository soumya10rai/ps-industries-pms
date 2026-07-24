import Link from "next/link";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import {
  MOCK_INVENTORY,
  MOCK_POS,
  MOCK_PRODUCTION_RUNS,
} from "@/lib/mock-data";
import { formatINR } from "@/lib/types";

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Admin Overview"
        subtitle="Configure users, monitor plant KPIs, and oversee every operational stream."
        actions={
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded border border-ps-navy px-4 py-2 text-sm font-semibold text-ps-navy"
            >
              Main Dashboard
            </Link>
            <Link
              href="/accountant/po-list"
              className="rounded bg-ps-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Manage Orders
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="PO Pipeline"
          value={formatINR(MOCK_POS.reduce((s, p) => s + p.total_amount, 0))}
          description="BMR + Kent + Prem"
        />
        <KPICard
          label="Users (sample)"
          value={5}
          description="Admin, Plant, Acc, Store, Prod"
        />
        <KPICard
          label="Low Stock"
          value={
            MOCK_INVENTORY.filter((i) => i.quantity <= i.reorder_level).length
          }
          description="Requires store action"
        />
        <KPICard
          label="Machines Busy"
          value={
            MOCK_PRODUCTION_RUNS.filter((r) => r.status === "running").length
          }
          description="Active IMM lines"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl font-bold text-ps-navy">
          Sample Accounts
        </h2>
        <DataTable headers={["Role", "Email", "Password", "Home"]}>
          {[
            ["Admin", "admin@psindustries.in", "admin123", "/dashboard"],
            [
              "Plant Head",
              "plant@psindustries.in",
              "plant123",
              "/plant-head/approvals",
            ],
            [
              "Accountant",
              "accountant@psindustries.in",
              "acc123",
              "/accountant/po-list",
            ],
            ["Store", "store@psindustries.in", "store123", "/store/inventory"],
            [
              "Production",
              "production@psindustries.in",
              "prod123",
              "/production/runs",
            ],
          ].map((row, i) => (
            <TableRow key={row[1]} index={i}>
              <Td className="font-semibold">{row[0]}</Td>
              <Td>{row[1]}</Td>
              <Td>
                <code className="rounded bg-ps-gray-100 px-1.5 py-0.5 text-xs">
                  {row[2]}
                </code>
              </Td>
              <Td>
                <Link href={row[3]} className="text-ps-navy hover:underline">
                  {row[3]}
                </Link>
              </Td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl font-bold text-ps-navy">
          Order Pipeline
        </h2>
        <DataTable
          headers={["PO", "Customer", "Items", "Total", "Status"]}
        >
          {MOCK_POS.map((po, i) => (
            <TableRow key={po.id} index={i}>
              <Td className="font-semibold text-ps-navy">{po.po_number}</Td>
              <Td>{po.customer_name}</Td>
              <Td>{po.items.length}</Td>
              <Td>{formatINR(po.total_amount)}</Td>
              <Td>
                <StatusBadge status={po.status} />
              </Td>
            </TableRow>
          ))}
        </DataTable>
      </section>
    </div>
  );
}
