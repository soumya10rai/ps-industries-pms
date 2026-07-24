import Link from "next/link";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { MOCK_POS, MOCK_INVENTORY, MOCK_PRODUCTION_RUNS } from "@/lib/mock-data";
import { formatINR } from "@/lib/types";

export default function DashboardPage() {
  const totalPOValue = MOCK_POS.reduce((s, p) => s + p.total_amount, 0);
  const pendingCount = MOCK_POS.filter((p) => p.status === "pending").length;
  const lowStock = MOCK_INVENTORY.filter(
    (i) => i.quantity <= i.reorder_level
  ).length;
  const activeRuns = MOCK_PRODUCTION_RUNS.filter(
    (r) => r.status === "running"
  ).length;

  return (
    <div className="ps-section">
      <PageHeader
        title="Dashboard"
        subtitle="Plant-wide overview for Greater Noida — orders, inventory, and production at a glance."
        actions={
          <Link href="/accountant/po-upload" className="btn-primary">
            Upload PO
          </Link>
        }
      />

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Open PO Value"
          value={formatINR(totalPOValue)}
          description="Across 3 active purchase orders"
        />
        <KPICard
          label="Pending Approvals"
          value={pendingCount}
          description="Awaiting Plant Head review"
        />
        <KPICard
          label="Low Stock SKUs"
          value={lowStock}
          description="At or below reorder level"
        />
        <KPICard
          label="Active Runs"
          value={activeRuns}
          description="Machines currently producing"
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between border-b border-ps-navy/20 pb-3">
          <h2 className="ps-heading-accent font-serif text-ps-h2 text-ps-navy">
            Recent Purchase Orders
          </h2>
          <Link
            href="/accountant/po-list"
            className="text-sm font-semibold text-ps-navy transition duration-200 ease-in-out hover:underline"
          >
            View all
          </Link>
        </div>
        <DataTable
          headers={[
            "PO Number",
            "Customer",
            "Items",
            "Total",
            "Status",
            "Date",
          ]}
        >
          {MOCK_POS.map((po, i) => (
            <TableRow key={po.id} index={i}>
              <Td className="font-semibold text-ps-navy">{po.po_number}</Td>
              <Td>{po.customer_name}</Td>
              <Td>{po.items.length}</Td>
              <Td className="font-medium">{formatINR(po.total_amount)}</Td>
              <Td>
                <StatusBadge status={po.status} />
              </Td>
              <Td>{po.po_date}</Td>
            </TableRow>
          ))}
        </DataTable>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Production Runs
          </h2>
          <DataTable headers={["Run", "Product", "Progress", "Status"]}>
            {MOCK_PRODUCTION_RUNS.map((run, i) => (
              <TableRow key={run.id} index={i}>
                <Td className="font-semibold text-ps-navy">{run.run_number}</Td>
                <Td className="max-w-[180px] truncate">{run.product}</Td>
                <Td>
                  {run.completed.toLocaleString("en-IN")} /{" "}
                  {run.quantity.toLocaleString("en-IN")}
                </Td>
                <Td>
                  <StatusBadge status={run.status} />
                </Td>
              </TableRow>
            ))}
          </DataTable>
        </div>
        <div>
          <h2 className="ps-heading-accent mb-4 font-serif text-ps-h2 text-ps-navy">
            Inventory Alerts
          </h2>
          <DataTable headers={["SKU", "Name", "Qty", "Reorder"]}>
            {MOCK_INVENTORY.filter((i) => i.quantity <= i.reorder_level * 1.5)
              .slice(0, 5)
              .map((item, i) => (
                <TableRow key={item.id} index={i}>
                  <Td className="font-semibold text-ps-navy">{item.sku}</Td>
                  <Td className="max-w-[160px] truncate">{item.name}</Td>
                  <Td
                    className={
                      item.quantity <= item.reorder_level
                        ? "font-semibold text-ps-red"
                        : ""
                    }
                  >
                    {item.quantity.toLocaleString("en-IN")} {item.uom}
                  </Td>
                  <Td>
                    {item.reorder_level.toLocaleString("en-IN")} {item.uom}
                  </Td>
                </TableRow>
              ))}
          </DataTable>
        </div>
      </section>
    </div>
  );
}
