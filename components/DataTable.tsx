import type { ReactNode } from "react";

interface DataTableProps {
  headers: string[];
  children: ReactNode;
}

export default function DataTable({ headers, children }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-ps-gray-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm leading-relaxed">
          <thead className="bg-ps-navy text-white">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-6 py-3.5 text-xs font-semibold uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ps-gray-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TableRow({
  children,
  index = 0,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <tr
      className={`transition duration-200 ease-in-out hover:bg-ps-gray-100 ${
        index % 2 === 0 ? "bg-white" : "bg-ps-gray-50/80"
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-6 py-3.5 text-ps-gray-700 ${className}`}
    >
      {children}
    </td>
  );
}
