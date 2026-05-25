/**
 * Animated visual panel rendered on the left side of every auth page (lg+).
 * Pure CSS — animated gradient mesh + floating blurred orbs + drifting
 * education emoji glyphs. All motion is in globals.css (`.auth-hero`,
 * `.auth-orb`, `.auth-glyph`) so there's no JS, no third-party deps,
 * no extra bundle weight.
 */
export function AuthHero() {
  return (
    <div className="auth-hero">
      {/* Animated blurred color orbs */}
      <div className="auth-orb o1" />
      <div className="auth-orb o2" />
      <div className="auth-orb o3" />

      {/* Drifting education glyphs */}
      <span className="auth-glyph g1" aria-hidden>
        📚
      </span>
      <span className="auth-glyph g2" aria-hidden>
        🎓
      </span>
      <span className="auth-glyph g3" aria-hidden>
        ✏️
      </span>
      <span className="auth-glyph g4" aria-hidden>
        🧮
      </span>
      <span className="auth-glyph g5" aria-hidden>
        💡
      </span>

      {/* Brand + tagline overlay */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="white">
              <rect x="1" y="1" width="5" height="5" rx="1" />
              <rect x="8" y="1" width="5" height="5" rx="1" />
              <rect x="1" y="8" width="5" height="5" rx="1" />
              <rect x="8" y="8" width="5" height="5" rx="1" />
            </svg>
          </div>
          <span
            className="text-[15px] font-extrabold text-white"
            style={{ letterSpacing: "-0.3px" }}
          >
            EduMeet
          </span>
        </div>

        <div className="max-w-md">
          <p
            className="text-[36px] font-extrabold leading-[1.05] text-white xl:text-[44px]"
            style={{ letterSpacing: "-1px" }}
          >
            Where teachers and students{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg,#A5B4FC 0%,#C4B5FD 60%,#F0ABFC 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              meet
            </span>{" "}
            to learn.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-white/55 xl:text-[14px]">
            Live classes with AI co-pilot, brain-token rewards, and tools that
            make every lesson click. One platform for the whole classroom.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/45 xl:text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="text-[14px]">🎓</span> Live classes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[14px]">🪙</span> Real-time rewards
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[14px]">🤖</span> AI co-pilot
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[14px]">📈</span> Progress tracking
          </span>
        </div>
      </div>
    </div>
  );
}
