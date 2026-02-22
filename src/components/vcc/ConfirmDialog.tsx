"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Description of the action being confirmed */
  description: string;
  /** If provided, user must type this exact string to confirm (for destructive actions) */
  confirmText?: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Visual style for confirm button */
  variant?: "danger" | "warning" | "default";
  /** Whether to show a reason textarea (required for VCC mutations) */
  requireReason?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

const variantStyles = {
  danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  warning: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
  default: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel = "Confirm",
  variant = "default",
  requireReason = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedConfirm, setTypedConfirm] = useState("");
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTypedConfirm("");
      setReason("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  const canConfirm =
    (!confirmText || typedConfirm === confirmText) &&
    (!requireReason || reason.trim().length > 0) &&
    !loading;

  const handleConfirm = useCallback(() => {
    if (canConfirm) onConfirm(reason.trim());
  }, [canConfirm, onConfirm, reason]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        {/* Confirm text input (destructive actions) */}
        {confirmText && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-mono text-red-600">{confirmText}</span> to confirm
            </label>
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={confirmText}
              autoFocus
            />
          </div>
        )}

        {/* Reason textarea */}
        {requireReason && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Explain why this action is being taken…"
              autoFocus={!confirmText}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]}`}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
