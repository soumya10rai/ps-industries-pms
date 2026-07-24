interface KPICardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: string;
}

export default function KPICard({
  label,
  value,
  description,
  trend,
}: KPICardProps) {
  return (
    <div className="border-l-4 border-ps-red bg-white p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ps-gray-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-bold text-ps-navy tabular-nums">
        {value}
      </p>
      {(description || trend) && (
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
