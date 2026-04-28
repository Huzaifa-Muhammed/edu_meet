"use client";

import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({ label, value, icon, trend, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-bd bg-surf p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wider text-t3">
          {label}
        </span>
        {icon && <span className="text-t3">{icon}</span>}
      </div>
      <span className="text-xl font-semibold tracking-tight text-t">
        {value}
      </span>
    </div>
  );
}
