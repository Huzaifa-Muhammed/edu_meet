"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronRight } from "lucide-react";

interface AgendaTabProps {
  meetingId: string;
}

// Mock data for initial scaffold — will be replaced with Firestore data
const mockTopics = [
  {
    id: "t1",
    title: "Introduction",
    status: "done" as const,
    subtopicCount: 3,
    subtopics: [
      { id: "s1", title: "Course overview", status: "done" as const },
      { id: "s2", title: "Meet the instructor", status: "done" as const },
      { id: "s3", title: "Prerequisites check", status: "done" as const },
    ],
  },
  {
    id: "t2",
    title: "Topic 1: Algebra",
    status: "active" as const,
    subtopicCount: 4,
    subtopics: [
      { id: "s4", title: "What is an equation?", status: "done" as const },
      { id: "s5", title: "Solving linear equations", status: "current" as const },
      { id: "s6", title: "Types of solutions", status: "pending" as const },
      { id: "s7", title: "Word problems", status: "pending" as const },
    ],
  },
  {
    id: "t3",
    title: "Topic 2: Quadratics",
    status: "pending" as const,
    subtopicCount: 3,
    subtopics: [
      { id: "s8", title: "Quadratic formula", status: "pending" as const },
      { id: "s9", title: "Completing the square", status: "pending" as const },
      { id: "s10", title: "Graphing parabolas", status: "pending" as const },
    ],
  },
];

export function AgendaTab({ meetingId }: AgendaTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["t2"]));

  function toggleTopic(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const completedCount = mockTopics.filter((t) => t.status === "done").length;

  return (
    <div>
      {/* Progress bar */}
      <div className="border-b border-sidebd px-3.5 py-2.5">
        <div className="mb-1.5 flex justify-between text-[10px] text-t3">
          <span>Progress</span>
          <span>
            {completedCount} of {mockTopics.length} complete
          </span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-bd">
          <div
            className="h-full rounded-full bg-acc transition-all"
            style={{
              width: `${(completedCount / mockTopics.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Topics */}
      {mockTopics.map((topic) => {
        const isOpen = expanded.has(topic.id);
        const isActive = topic.status === "active";

        return (
          <div key={topic.id} className="border-b border-sidebd">
            <button
              onClick={() => toggleTopic(topic.id)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-sidenav" : "hover:bg-panel2",
              )}
            >
              {/* Status dot */}
              <div
                className={cn(
                  "h-2.5 w-2.5 flex-shrink-0 rounded-full border-2",
                  topic.status === "done"
                    ? "border-acc bg-acc"
                    : topic.status === "active"
                      ? "border-green bg-green shadow-[0_0_0_3px_rgba(74,222,128,.2)]"
                      : "border-bd2 bg-transparent",
                )}
              />

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-xs font-medium",
                    isActive
                      ? "font-semibold text-white/95"
                      : topic.status === "done"
                        ? "text-t3"
                        : "text-t3",
                  )}
                >
                  {topic.title}
                </div>
                <div
                  className={cn(
                    "text-[10px]",
                    isActive ? "text-white/40" : "text-t3",
                  )}
                >
                  {topic.subtopicCount} subtopics
                  {topic.status === "done" && " · Done"}
                  {topic.status === "active" && " · Active"}
                </div>
              </div>

              {topic.status === "done" && (
                <span className="rounded bg-gbg px-1.5 py-0.5 text-[8px] font-bold uppercase text-gt">
                  Done
                </span>
              )}
              {topic.status === "active" && (
                <span className="rounded bg-accbg px-1.5 py-0.5 text-[8px] font-bold uppercase text-t">
                  Active
                </span>
              )}

              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform",
                  isActive ? "text-white/40" : "text-t3",
                  isOpen && "rotate-90",
                )}
              />
            </button>

            {/* Subtopics drawer */}
            <div
              className={cn(
                "overflow-hidden transition-all",
                isOpen ? "max-h-[500px]" : "max-h-0",
                isActive && "border-l-[3px] border-sidenav bg-[rgba(44,43,39,.03)]",
              )}
            >
              <div className="px-3.5 py-1">
                {topic.subtopics.map((sub) => (
                  <div
                    key={sub.id}
                    className={cn(
                      "cursor-pointer rounded-lg px-2 py-1.5 transition-colors",
                      sub.status === "current"
                        ? "bg-panel2"
                        : "hover:bg-panel2",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        sub.status === "done"
                          ? "text-t3"
                          : sub.status === "current"
                            ? "font-medium text-t"
                            : "text-t2",
                      )}
                    >
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
