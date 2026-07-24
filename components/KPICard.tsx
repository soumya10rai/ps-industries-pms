interface KPICardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: string;
  isLoading?: boolean;
  error?: string | null;
}

export default function KPICard({
  label,
  value,
  description,
  trend,
  isLoading = false,
  error = null,
}: KPICardProps) {
  return (
    <div className="border-l-4 border-ps-red bg-white p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
        {label}
      </p>

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2" role="status">
          <span
            className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-ps-navy/20 border-t-ps-navy"
            aria-hidden="true"
          />
          <span className="text-sm text-ps-gray-500">Loading…</span>
        </div>
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-ps-red" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2 font-serif text-3xl font-bold text-ps-navy tabular-nums">
          {value}
        </p>
      )}

      {(description || trend) && !error && (
        <p className="mt-2 text-sm text-ps-gray-500">
          {description}
          {trend && (
            <span className="ml-2 font-medium text-ps-gray-600">{trend}</span>
          )}
        </p>
      )}
    </div>
  );
}
