"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ArrowLeft, FileText, ListChecks, MessageCircleQuestion } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api/client";

export type ClassRecap = {
  classroomName: string;
  subjectName: string;
  teacherName: string;
  date: string;
  endedAt: string | null;
  agenda: { title: string; description: string; done: boolean }[];
  topicsCovered: string[];
  notes: { text: string; authorName: string; createdAt: string }[];
  questions: { text: string; askedByName: string; answer: string | null }[];
};

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** Opens a print-friendly window with the recap and triggers the browser's
 *  print dialog (Save as PDF). Dependency-free. */
function downloadPdf(r: ClassRecap) {
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;
  const dateLabel = r.date ? format(new Date(`${r.date}T00:00:00`), "EEEE, MMMM d, yyyy") : "";
  const section = (title: string, body: string) =>
    body ? `<h2>${esc(title)}</h2>${body}` : "";

  const agenda = r.agenda.length
    ? `<ul>${r.agenda
        .map(
          (a) =>
            `<li>${a.done ? "✅ " : "▫️ "}<b>${esc(a.title)}</b>${
              a.description ? ` — ${esc(a.description)}` : ""
            }</li>`,
        )
        .join("")}</ul>`
    : "";
  const notes = r.notes.length
    ? `<ul>${r.notes.map((n) => `<li>${esc(n.text)} <i>— ${esc(n.authorName)}</i></li>`).join("")}</ul>`
    : "";
  const questions = r.questions.length
    ? `<ul>${r.questions
        .map(
          (q) =>
            `<li><b>Q:</b> ${esc(q.text)}${
              q.answer ? `<br/><b>A:</b> ${esc(q.answer)}` : ""
            } <i>— ${esc(q.askedByName)}</i></li>`,
        )
        .join("")}</ul>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Class Recap — ${esc(
    r.classroomName,
  )}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.5}
    h1{font-size:22px;margin:0 0 4px}
    .meta{color:#666;font-size:13px;margin-bottom:20px}
    h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
    ul{margin:0;padding-left:20px}
    li{margin:5px 0;font-size:13px}
    .pills span{display:inline-block;background:#eef;border-radius:10px;padding:2px 8px;margin:2px;font-size:12px}
  </style></head><body>
    <h1>${esc(r.classroomName)}</h1>
    <div class="meta">${esc(r.subjectName)} · ${esc(r.teacherName)}${dateLabel ? ` · ${dateLabel}` : ""}</div>
    ${
      r.topicsCovered.length
        ? `<h2>Topics covered</h2><div class="pills">${r.topicsCovered
            .map((t) => `<span>${esc(t)}</span>`)
            .join("")}</div>`
        : ""
    }
    ${section("Agenda", agenda)}
    ${section("Notes from class", notes)}
    ${section("Questions discussed", questions)}
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}

export function ClassRecapScreen({
  meetingId,
  onBack,
}: {
  meetingId: string;
  onBack: () => void;
}) {
  const q = useQuery<ClassRecap>({
    queryKey: ["class-recap", meetingId],
    queryFn: () => api.get(`/student/class-recap/${meetingId}`) as unknown as Promise<ClassRecap>,
    enabled: !!meetingId,
  });
  const r = q.data;

  return (
    <div className="flex h-screen flex-col items-center overflow-y-auto bg-black px-4 py-10 text-white">
      <div className="w-full max-w-xl">
        <div className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Class ended · here&apos;s your recap
        </div>

        {q.isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white/5" />
        ) : !r ? (
          <p className="mt-6 text-center text-sm text-white/60">
            Recap unavailable.
          </p>
        ) : (
          <div
            className="mt-3 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <h1 className="text-lg font-extrabold">{r.classroomName}</h1>
            <p className="mt-0.5 text-xs text-white/50">
              {r.subjectName} · {r.teacherName}
              {r.date ? ` · ${format(new Date(`${r.date}T00:00:00`), "MMM d, yyyy")}` : ""}
            </p>

            {r.topicsCovered.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/45">
                  Topics covered
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {r.topicsCovered.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "rgba(99,102,241,.2)", color: "#C7D2FE" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <RecapSection icon={<ListChecks className="h-3.5 w-3.5" />} title="Agenda">
              {r.agenda.length ? (
                <ul className="space-y-1.5">
                  {r.agenda.map((a, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px]">
                      <span>{a.done ? "✅" : "▫️"}</span>
                      <span className="text-white/80">
                        <span className="font-semibold text-white">{a.title}</span>
                        {a.description ? ` — ${a.description}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No agenda was set for this class.</Empty>
              )}
            </RecapSection>

            <RecapSection icon={<FileText className="h-3.5 w-3.5" />} title="Notes from class">
              {r.notes.length ? (
                <ul className="space-y-2">
                  {r.notes.map((n, i) => (
                    <li key={i} className="text-[12.5px] text-white/80">
                      {n.text}
                      <span className="text-white/40"> — {n.authorName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No notes were shared.</Empty>
              )}
            </RecapSection>

            <RecapSection
              icon={<MessageCircleQuestion className="h-3.5 w-3.5" />}
              title="Questions discussed"
            >
              {r.questions.length ? (
                <ul className="space-y-2.5">
                  {r.questions.map((qq, i) => (
                    <li key={i} className="text-[12.5px]">
                      <p className="font-semibold text-white">Q: {qq.text}</p>
                      {qq.answer && <p className="mt-0.5 text-white/70">A: {qq.answer}</p>}
                      <p className="mt-0.5 text-[10px] text-white/35">— {qq.askedByName}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No questions were answered in class.</Empty>
              )}
            </RecapSection>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </button>
          {r && (
            <button
              onClick={() => downloadPdf(r)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecapSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/45">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-white/35">{children}</p>;
}
