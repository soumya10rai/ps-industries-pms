import PageHeader from "@/components/PageHeader";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import DataTable, { TableRow, Td } from "@/components/DataTable";
import { MOCK_PRODUCTION_RUNS } from "@/lib/mock-data";

export default function ProductionRunsPage() {
  const running = MOCK_PRODUCTION_RUNS.filter((r) => r.status === "running");
  const scheduled = MOCK_PRODUCTION_RUNS.filter(
    (r) => r.status === "scheduled"
  );
  const completed = MOCK_PRODUCTION_RUNS.filter(
    (r) => r.status === "completed"
  );

  return (
    <div>
      <PageHeader
        title="Production Runs"
        subtitle="Injection moulding schedules and live progress against customer purchase orders."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KPICard label="Running" value={running.length} description="Active IMM lines" />
        <KPICard
          label="Scheduled"
          value={scheduled.length}
          description="Queued for start"
        />
        <KPICard
          label="Completed"
          value={completed.length}
          description="Closed this cycle"
        />
      </div>

      <DataTable
        headers={[
          "Run #",
          "PO",
          "Customer",
          "Product",
          "Machine",
          "Progress",
          "Due",
          "Status",
        ]}
      >
        {MOCK_PRODUCTION_RUNS.map((run, i) => {
          const pct = Math.round((run.completed / run.quantity) * 100);
          return (
            <TableRow key={run.id} index={i}>
              <Td className="font-semibold text-ps-navy">{run.run_number}</Td>
              <Td>{run.po_number}</Td>
              <Td className="max-w-[160px] truncate">{run.customer}</Td>
              <Td className="max-w-[200px] truncate">{run.product}</Td>
              <Td>{run.machine}</Td>
              <Td>
                <div className="min-w-[120px]">
                  <div className="mb-1 flex justify-between text-xs text-ps-gray-500">
                    <span>
                      {run.completed.toLocaleString("en-IN")} /{" "}
                      {run.quantity.toLocaleString("en-IN")}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-ps-gray-200">
                    <div
                      className="h-full bg-ps-navy"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Td>
              <Td>{run.due_date}</Td>
              <Td>
                <StatusBadge status={run.status} />
              </Td>
            </TableRow>
          );
        })}
      </DataTable>
    </div>
  );
}
