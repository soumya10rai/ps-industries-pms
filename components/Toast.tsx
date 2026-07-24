"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  durationMs?: number;
}

export default function Toast({
  message,
  type = "success",
  onClose,
  durationMs = 2500,
}: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [onClose, durationMs]);

  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : type === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-blue-200 bg-blue-50 text-blue-900";

  return (
    <div
      role="status"
      className={`fixed right-4 top-20 z-[80] max-w-sm rounded border px-4 py-3 text-sm font-medium shadow-lg ${styles}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-current/70 hover:text-current"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
