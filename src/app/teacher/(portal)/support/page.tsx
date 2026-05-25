"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";

type ProblemType = "technical" | "lesson" | "account" | "other";
type Priority = "low" | "normal" | "high";

const FAQ: { q: string; a: string }[] = [
  {
    q: "VideoSDK keeps reconnecting / black tile",
    a: "Refresh the meeting tab. If it persists, check the VideoSDK key in .env and that no firewall is blocking *.videosdk.live.",
  },
  {
    q: "A student says they can't join",
    a: "Confirm they're enrolled (Students page) and not blocked. Banned uids fail at the token endpoint — if you kicked them, click 'Unban' from the live classroom Students panel.",
  },
  {
    q: "Submissions aren't showing up in Grading",
    a: "Short-answer questions move from auto-grade to your review queue. Check the Grading page; submissions land there within a few seconds of student submit.",
  },
];

const PROBLEMS: { id: ProblemType; emoji: string; label: string }[] = [
  { id: "technical", emoji: "💻", label: "Technical" },
  { id: "lesson", emoji: "📚", label: "Lesson tools" },
  { id: "account", emoji: "👤", label: "Account" },
  { id: "other", emoji: "❓", label: "Other" },
];

const PRIORITIES: { id: Priority; emoji: string; label: string }[] = [
  { id: "low", emoji: "🟢", label: "Low" },
  { id: "normal", emoji: "🟡", label: "Medium" },
  { id: "high", emoji: "🔴", label: "High — Urgent" },
];

export default function TeacherSupportPage() {
  const [problemType, setProblemType] = useState<ProblemType>("technical");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  type Payload = {
    problemType: ProblemType;
    subject: string;
    details: string;
    priority: Priority;
  };

  const submit = useMutation({
    mutationFn: (data: Payload) => api.post("/student/support", data),
    onSuccess: () => {
      toast.success("Ticket submitted. Admin will get back to you shortly.");
      setSubject("");
      setDetails("");
      setPriority("normal");
      setProblemType("technical");
    },
    onError: (err: Error) => {
      console.error("[support submit]", err);
      toast.error(err.message || "Could not submit. Please try again.");
    },
  });

  return (
    <div className="min-h-full bg-bg p-[22px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleanSubject = subject.trim();
            const cleanDetails = details.trim();
            if (cleanSubject.length < 2) {
              toast.error("Subject must be at least 2 characters.");
              return;
            }
            if (cleanDetails.length < 5) {
              toast.error("Please add at least 5 characters of detail.");
              return;
            }
            submit.mutate({
              problemType,
              subject: cleanSubject,
              details: cleanDetails,
              priority,
            });
          }}
          className="flex flex-col gap-3.5 rounded-[16px] p-[18px]"
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <Field label="Problem type">
            <div className="flex flex-wrap gap-[7px]">
              {PROBLEMS.map((p) => (
                <Chip
                  key={p.id}
                  active={problemType === p.id}
                  onClick={() => setProblemType(p.id)}
                >
                  <span>{p.emoji}</span>
                  {p.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description…"
              className="w-full rounded-[9px] px-3 py-[9px] text-[12px] text-white outline-none transition-colors"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.1)")}
              maxLength={120}
            />
          </Field>

          <Field label="Details">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="What happened? Steps to reproduce, expected vs actual behavior…"
              className="w-full resize-none rounded-[9px] px-3 py-[9px] text-[12px] text-white outline-none transition-colors"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.1)")}
            />
          </Field>

          <Field label="Priority">
            <div className="flex flex-wrap gap-[7px]">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p.id}
                  active={priority === p.id}
                  onClick={() => setPriority(p.id)}
                >
                  <span>{p.emoji}</span>
                  {p.label}
                </Chip>
              ))}
            </div>
          </Field>

          <button
            type="submit"
            disabled={submit.isPending}
            className="rounded-[11px] py-[11px] text-[12px] font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#D97706,#B45309)" }}
          >
            {submit.isPending ? "Submitting…" : "📨 Send to admin"}
          </button>
        </form>

        <aside className="flex flex-col">
          <ContactItem emoji="📧" title="support@edumeet.app" sub="Response within 24 hours" />
          <ContactItem emoji="💬" title="Admin chat" sub="During business hours" />
          <ContactItem emoji="📚" title="Teacher handbook" sub="Best practices + tips" />

          <p
            className="mb-2.5 mt-5 text-[11px] font-bold uppercase text-white/50"
            style={{ letterSpacing: "0.5px" }}
          >
            Quick answers
          </p>
          <ul className="flex flex-col gap-1.5">
            {FAQ.map((f, i) => (
              <li
                key={i}
                className="cursor-pointer overflow-hidden rounded-[10px]"
                style={{ border: "1px solid rgba(255,255,255,.07)" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[11.5px] font-semibold text-white/75"
                >
                  {f.q}
                  <span className="text-white/40">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-3 pb-2.5 text-[11px] leading-[1.6] text-white/45">
                    {f.a}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[10.5px] font-bold uppercase text-white/50"
        style={{ letterSpacing: "0.4px" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-[8px] px-3 py-[6px] text-[11px] transition-all"
      style={{
        background: active ? "rgba(245,158,11,.14)" : "rgba(255,255,255,.04)",
        border: active
          ? "1px solid rgba(245,158,11,.4)"
          : "1px solid rgba(255,255,255,.08)",
        color: active ? "#FCD34D" : "rgba(255,255,255,.6)",
      }}
    >
      {children}
    </button>
  );
}

function ContactItem({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div
      className="flex items-center gap-2.5 py-[11px]"
      style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-[15px]"
        style={{ background: "rgba(245,158,11,.14)" }}
      >
        {emoji}
      </span>
      <div>
        <p className="text-[12px] font-semibold text-white/80">{title}</p>
        <p className="mt-0.5 text-[10px] text-white/35">{sub}</p>
      </div>
    </div>
  );
}
