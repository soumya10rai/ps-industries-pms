import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-ps-navy text-white shadow-btn hover:bg-[#163075] hover:shadow-card-hover disabled:bg-ps-navy/60",
  secondary:
    "border border-ps-navy text-ps-navy bg-white hover:bg-ps-gray-50 hover:shadow-btn",
  danger: "bg-ps-red text-white shadow-btn hover:bg-red-700 hover:shadow-card-hover",
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
