interface KPICardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: string;
  /** Highlight badge on the value (e.g. pending / low stock). */
  badge?: "red" | "amber" | null;
  loading?: boolean;
}

export default function KPICard({
  label,
  value,
  description,
  trend,
  badge = null,
  loading = false,
}: KPICardProps) {
  return (
    <div className="border-l-4 border-ps-red bg-white p-6 shadow-card transition duration-200 ease-in-out hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
          {label}
        </p>
        {!loading && badge && typeof value === "number" && value > 0 && (
          <span
            className={`inline-flex min-w-[1.5rem] items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold text-white ${
              badge === "amber" ? "bg-amber-500" : "bg-ps-red"
            }`}
          >
            {value}
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-8 w-24 animate-pulse rounded bg-ps-gray-100" />
          <div className="h-3 w-36 animate-pulse rounded bg-ps-gray-100" />
        </div>
      ) : (
        <>
          <p className="mt-2 font-serif text-3xl font-bold leading-relaxed text-ps-navy tabular-nums">
            {value}
          </p>
          {(description || trend) && (
            <p className="mt-2 text-sm leading-relaxed text-ps-gray-500">
              {description}
              {trend && (
                <span className="ml-2 font-medium text-ps-gray-600">
                  {trend}
                </span>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
