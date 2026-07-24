"use client";

import { useCallback, useRef, useState } from "react";

interface FileUploadZoneProps {
  accept?: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onInvalidFile?: (message: string) => void;
  hint?: string;
}

export default function FileUploadZone({
  accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  disabled = false,
  onFileSelected,
  onInvalidFile,
  hint = "Drag & drop an .xlsx file here, or click to browse",
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validateAndEmit = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx")) {
        onInvalidFile?.("Invalid file format. Please upload an .xlsx Excel file.");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected, onInvalidFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        validateAndEmit(e.dataTransfer.files?.[0] ?? null);
      }}
      className={`cursor-pointer rounded-lg border-2 border-dashed bg-white px-6 py-10 text-center transition ${
        dragging
          ? "border-ps-navy bg-blue-50"
          : "border-ps-gray-300 hover:border-ps-navy/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ps-navy/10 text-ps-navy">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ps-navy">{hint}</p>
      <p className="mt-1 text-xs text-ps-gray-500">
        Accepted: .xlsx only · Columns: Material Name, Quantity, Location,
        Reorder Level
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          validateAndEmit(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}
