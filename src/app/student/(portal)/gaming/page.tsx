"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";

type Game = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  tags: string[];
};

const GAMES: Game[] = [
  {
    id: "word-scramble",
    title: "Word Scramble",
    emoji: "🔤",
    blurb:
      "Unscramble topic words against the clock. Great for vocabulary practice in any subject.",
    tags: ["Vocabulary", "All subjects"],
  },
  {
    id: "quick-fire",
    title: "Quick Fire Quiz",
    emoji: "⚡",
    blurb:
      "Rapid-fire MCQ drills pulled from your teacher's question bank. Earn BT on every correct streak.",
    tags: ["MCQ", "Pace"],
  },
];

export default function GamingRoomPage() {
  return (
    <div className="min-h-full bg-bg p-[22px]">
      <p
        className="mb-3 text-[12px] font-bold uppercase text-white/50"
        style={{ letterSpacing: "0.6px" }}
      >
        🎮 Gaming Room
      </p>

      <div
        className="mb-4 flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[11px]"
        style={{
          background: "rgba(245,158,11,.08)",
          border: "1px solid rgba(245,158,11,.25)",
          color: "#FCD34D",
        }}
      >
        <span>🚧</span>
        Preview only — the full game engine + API lives in a separate project and will plug in
        here. Brain Tokens still come from class activity in the meantime.
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        {GAMES.map((g) => (
          <article
            key={g.id}
            className="flex flex-col rounded-[18px] p-5"
            style={{
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[12px] text-[26px]"
                style={{ background: "rgba(99,102,241,.12)" }}
              >
                {g.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white">{g.title}</p>
                <p
                  className="mt-1 text-[11px] text-white/45"
                  style={{ lineHeight: 1.5 }}
                >
                  {g.blurb}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.5)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              disabled
              className="mt-4 w-full rounded-full py-[9px] text-[11px] font-bold"
              style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                color: "rgba(255,255,255,.35)",
                cursor: "not-allowed",
              }}
            >
              Coming soon
            </button>
          </article>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-white/40">
        Got a game idea?{" "}
        <Link
          href="/student/support"
          className="font-semibold text-[#A5B4FC] hover:underline"
        >
          Tell us on the Support page.
        </Link>
      </p>
    </div>
  );
}
