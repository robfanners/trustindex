"use client";

import { Toaster, toast } from "sonner";

export function ToastProvider() {
  return <Toaster position="top-right" richColors closeButton />;
}

export function showActionToast(
  message: string,
  link?: { label: string; href: string },
) {
  toast.success(message, {
    action: link
      ? {
          label: link.label,
          onClick: () => {
            window.location.href = link.href;
          },
        }
      : undefined,
  });
}

export function showErrorToast(message: string) {
  toast.error(message);
}
