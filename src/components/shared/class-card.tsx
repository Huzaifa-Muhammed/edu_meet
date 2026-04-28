"use client";

import { cn } from "@/lib/utils/cn";
import { Calendar, Users, PlayCircle, FileText, ClipboardList } from "lucide-react";
import { format } from "date-fns";

interface ClassCardProps {
  title: string;
  subtitle?: string;
  date?: string;
  studentCount?: number;
  status?: "scheduled" | "live" | "ended";
  onJoin?: () => void;
  onViewRecording?: () => void;
  onViewSummary?: () => void;
  onCreateAssessment?: () => void;
  className?: string;
}

export function ClassCard({
  title,
  subtitle,
  date,
  studentCount,
  status = "scheduled",
  onJoin,
  onViewRecording,
  onViewSummary,
  onCreateAssessment,
  className,
}: ClassCardProps) {
  const isLive = status === "live";
  const isPast = status === "ended";

  return (
    <div
      className={cn(
        "rounded-xl border bg-surf p-4 transition-shadow hover:shadow-md",
        isLive ? "border-green" : "border-bd",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-t">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-t3">{subtitle}</p>
          )}
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 rounded-full bg-gbg px-2 py-0.5 text-[10px] font-bold uppercase text-gt">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
            Live
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-t3">
        {date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(date), "MMM d, h:mm a")}
          </span>
        )}
        {studentCount != null && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {studentCount} students
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(isLive || status === "scheduled") && onJoin && (
          <button
            onClick={onJoin}
            className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            {isLive ? "Join live" : "Start class"}
          </button>
        )}
        {onCreateAssessment && (
          <button
            onClick={onCreateAssessment}
            className="flex items-center gap-1.5 rounded-lg border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 transition-colors hover:bg-panel"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Create assessment
          </button>
        )}
        {isPast && onViewRecording && (
          <button
            onClick={onViewRecording}
            className="flex items-center gap-1.5 rounded-lg border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 transition-colors hover:bg-panel"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Recording
          </button>
        )}
        {isPast && onViewSummary && (
          <button
            onClick={onViewSummary}
            className="flex items-center gap-1.5 rounded-lg border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 transition-colors hover:bg-panel"
          >
            <FileText className="h-3.5 w-3.5" />
            Summary
          </button>
        )}
      </div>
    </div>
  );
}
