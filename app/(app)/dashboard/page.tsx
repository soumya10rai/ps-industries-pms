import Link from "next/link";
import DashboardKPICards from "@/components/DashboardKPICards";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { MOCK_POS, MOCK_INVENTORY, MOCK_PRODUCTION_RUNS } from "@/lib/mock-data";
import { formatINR } from "@/lib/types";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Plant-wide overview for Greater Noida — orders, inventory, and production at a glance."
        actions={
          <Link
            href="/accountant/po-upload"
            className="rounded bg-ps-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#163075]"
          >
            Upload PO
          </Link>
        }
      />

      <DashboardKPICards />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-ps-navy">
            Recent Purchase Orders
          </h2>
          <Link
            href="/accountant/po-list"
            className="text-sm font-semibold text-ps-navy hover:underline"
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

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-serif text-xl font-bold text-ps-navy">
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
          <h2 className="mb-3 font-serif text-xl font-bold text-ps-navy">
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
