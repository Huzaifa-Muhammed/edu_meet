"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-xl border border-bd bg-surf shadow-2xl",
          sizes[size],
          className,
        )}
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-bd px-5 py-4">
            <div>
              {title && <h2 className="text-sm font-semibold text-t">{title}</h2>}
              {description && (
                <p className="mt-1 text-xs text-t3">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-t3 hover:bg-panel hover:text-t"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-bd bg-panel/30 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
