import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { MOCK_INVENTORY, MOCK_POS } from "@/lib/mock-data";
import { formatINR } from "@/lib/types";

export default function MaterialCheckPage() {
  const checks = MOCK_POS.filter(
    (p) => p.status === "material_check" || p.status === "approved"
  );

  return (
    <div>
      <PageHeader
        title="Material Check"
        subtitle="Verify raw materials and components against approved purchase order line items."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KPICard label="POs in Check" value={checks.length} />
        <KPICard
          label="Low Stock SKUs"
          value={
            MOCK_INVENTORY.filter((i) => i.quantity <= i.reorder_level).length
          }
        />
        <KPICard
          label="Check Value"
          value={formatINR(checks.reduce((s, p) => s + p.total_amount, 0))}
        />
      </div>

      {checks.map((po) => (
        <section key={po.id} className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-xl font-bold text-ps-navy">
              {po.po_number}
            </h2>
            <StatusBadge status={po.status} />
            <span className="text-sm text-ps-gray-500">
              {po.customer_name} · {formatINR(po.total_amount)}
            </span>
          </div>

          <DataTable
            headers={[
              "Item Code",
              "Description",
              "Required Qty",
              "Stock Match",
              "Availability",
            ]}
          >
            {po.items.map((item, i) => {
              const stock = MOCK_INVENTORY.find(
                (inv) =>
                  inv.sku.includes(item.item_code.slice(0, 4)) ||
                  inv.name
                    .toLowerCase()
                    .includes(item.description.split(" ")[0].toLowerCase())
              );
              const available = stock?.quantity ?? 0;
              const ok = available >= item.quantity * 0.1;

              return (
                <TableRow key={item.item_code} index={i}>
                  <Td className="font-semibold text-ps-navy">
                    {item.item_code}
                  </Td>
                  <Td className="max-w-[240px] truncate">{item.description}</Td>
                  <Td>
                    {item.quantity.toLocaleString("en-IN")} {item.uom}
                  </Td>
                  <Td>{stock?.sku ?? "No direct SKU"}</Td>
                  <Td
                    className={
                      ok ? "font-medium text-emerald-700" : "font-medium text-ps-red"
                    }
                  >
                    {stock
                      ? `${available.toLocaleString("en-IN")} ${stock.uom}`
                      : "Check store"}
                  </Td>
                </TableRow>
              );
            })}
          </DataTable>
        </section>
      ))}
    </div>
  );
}
