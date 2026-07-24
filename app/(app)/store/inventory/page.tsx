import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { MOCK_INVENTORY } from "@/lib/mock-data";

export default function InventoryPage() {
  const low = MOCK_INVENTORY.filter((i) => i.quantity <= i.reorder_level);
  const totalSku = MOCK_INVENTORY.length;
  const categories = new Set(MOCK_INVENTORY.map((i) => i.category)).size;

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Store stock levels for Greater Noida Plant — raw materials, components, and finished goods."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KPICard label="Total SKUs" value={totalSku} description="Active catalogue" />
        <KPICard
          label="Low Stock"
          value={low.length}
          description="At or below reorder"
        />
        <KPICard
          label="Categories"
          value={categories}
          description="Material groupings"
        />
      </div>

      <DataTable
        headers={[
          "SKU",
          "Name",
          "Category",
          "Quantity",
          "Reorder",
          "Location",
          "Updated",
        ]}
      >
        {MOCK_INVENTORY.map((item, i) => {
          const isLow = item.quantity <= item.reorder_level;
          return (
            <TableRow key={item.id} index={i}>
              <Td className="font-semibold text-ps-navy">{item.sku}</Td>
              <Td>{item.name}</Td>
              <Td>{item.category}</Td>
              <Td className={isLow ? "font-semibold text-ps-red" : ""}>
                {item.quantity.toLocaleString("en-IN")} {item.uom}
              </Td>
              <Td>
                {item.reorder_level.toLocaleString("en-IN")} {item.uom}
              </Td>
              <Td>{item.location}</Td>
              <Td>{item.last_updated}</Td>
            </TableRow>
          );
        })}
      </DataTable>
    </div>
  );
}
