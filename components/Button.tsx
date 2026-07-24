import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-ps-navy text-white hover:bg-[#163075] disabled:bg-ps-navy/60",
  secondary:
    "border border-ps-navy text-ps-navy bg-white hover:bg-ps-gray-50",
  danger: "bg-ps-red text-white hover:bg-red-700",
  ghost: "text-ps-navy hover:bg-ps-gray-100",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
