"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

const DISMISS_KEY = "edumeet:syllabus-nudge-dismissed";

function loadDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Floating nudge for users who joined before the exam-board ("syllabus")
 * feature and have no board on file. Students are missing `syllabus`/`grade`;
 * approved teachers are missing `applicationSyllabi`. Sends them to their
 * profile to set it — the popup disappears on its own once the field is filled
 * (the gating condition goes false) or when dismissed. Mounted globally in each
 * portal layout; it self-gates by role so mounting in both is safe.
 */
export function SyllabusNudgePopup() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<boolean>(() => loadDismissed());

  if (!user || dismissed) return null;

  const approved =
    user.status === "approved" || user.applicationStatus === "approved";

  let show = false;
  let href = "";
  let title = "";
  let body = "";

  if (user.role === "student") {
    show = !user.syllabus || user.grade == null;
    href = "/student/profile";
    title = "Set your exam board";
    body =
      "Add your grade and exam board (Edexcel, AQA, Cambridge…) so your classes and study materials match your curriculum.";
  } else if (user.role === "teacher" && approved) {
    show = !(user.applicationSyllabi && user.applicationSyllabi.length > 0);
    href = "/teacher/profile";
    title = "Set the boards you teach";
    body =
      "Add the exam boards you teach so new classes default to the right board and the AI scheduler matches your curriculum.";
  }

  if (!show) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed bottom-5 left-5 z-50 w-[330px] overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: "var(--surf)", borderColor: "var(--acc)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "var(--accbg)" }}
      >
        <BookMarked className="h-4 w-4" style={{ color: "var(--acc)" }} />
        <span className="flex-1 text-xs font-bold text-t">{title}</span>
        <button onClick={dismiss} className="text-t3 hover:text-t" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        <p className="text-[11px] text-t2">{body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => router.push(href)}
            className="flex-1 rounded-lg bg-acc px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Update profile →
          </button>
          <button
            onClick={dismiss}
            className="rounded-lg border border-bd bg-surf px-3 py-2 text-xs font-semibold text-t2 hover:bg-panel"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
