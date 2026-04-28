"use client";

import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          },
        }}
      />
    </>
  );
}
