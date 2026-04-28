"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";

type Game = "scramble" | "memory" | "sprint" | "sequence";
type Difficulty = "Easy" | "Medium" | "Hard";

const GAME_META: Record<Game, { label: string; difficulty: Difficulty }> = {
  scramble: { label: "🔤 Word Scramble", difficulty: "Medium" },
  memory: { label: "🧠 Memory Match", difficulty: "Easy" },
  sprint: { label: "⚡ Math Sprint", difficulty: "Hard" },
  sequence: { label: "🔢 Number Sequence", difficulty: "Medium" },
};

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string; border: string }> = {
  Easy: { bg: "rgba(74,232,160,0.18)", color: "#4AE8A0", border: "rgba(74,232,160,0.35)" },
  Medium: { bg: "rgba(94,207,234,0.18)", color: "#5ECFEA", border: "rgba(94,207,234,0.35)" },
  Hard: { bg: "rgba(255,112,128,0.18)", color: "#FF7080", border: "rgba(255,112,128,0.35)" },
};

const PER_CLAIM_MAX = 10;

/** Four simple client-side games for the classroom Gaming Room tab.
 *  Each successful round increments an unclaimed-coin counter; the student
 *  taps "Claim" to credit BT via /api/student/games/claim. Server-side caps
 *  keep the placeholder fair until the real games engine ships. */
export function GamingPane({
  meetingId,
  classroomId,
}: {
  meetingId?: string;
  classroomId?: string;
}) {
  const [game, setGame] = useState<Game>("scramble");

  return (
    <div className="gr-shell">
      <div className="gr-hdr">
        <div>
          <div className="gr-title">🎮 Gaming Room</div>
          <div className="gr-sub">
            Warm-up games · 1 BT per correct round · 30 BT/day cap
          </div>
        </div>
      </div>

      <div className="gr-pills">
        {(Object.keys(GAME_META) as Game[]).map((g) => {
          const meta = GAME_META[g];
          const ds = DIFFICULTY_STYLE[meta.difficulty];
          return (
            <div
              key={g}
              className={`gr-pill${game === g ? " active" : ""}`}
              onClick={() => setGame(g)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>{meta.label}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: ds.bg,
                  color: ds.color,
                  border: `1px solid ${ds.border}`,
                }}
              >
                {meta.difficulty}
              </span>
            </div>
          );
        })}
      </div>

      <div className="gr-body">
        {game === "scramble" && (
          <WordScramble meetingId={meetingId} classroomId={classroomId} />
        )}
        {game === "memory" && (
          <MemoryMatch meetingId={meetingId} classroomId={classroomId} />
        )}
        {game === "sprint" && (
          <MathSprint meetingId={meetingId} classroomId={classroomId} />
        )}
        {game === "sequence" && (
          <NumberSequence meetingId={meetingId} classroomId={classroomId} />
        )}
      </div>
    </div>
  );
}

/* ─────────── Claim hook + UI ─────────── */

type ClaimResp = { claimed: number; newBalance: number; capped: boolean };

function useGameClaim(game: Game, meetingId?: string, classroomId?: string) {
  const qc = useQueryClient();
  const [unclaimed, setUnclaimed] = useState(0);

  const mut = useMutation<ClaimResp, Error, number>({
    mutationFn: (count) =>
      api.post("/student/games/claim", {
        game,
        count,
        meetingId,
        classroomId,
      }) as unknown as Promise<ClaimResp>,
    onSuccess: (res) => {
      if (res.claimed > 0) {
        toast.success(`🪙 +${res.claimed} BT claimed · balance ${res.newBalance}`);
      } else {
        toast.info("Daily game-coin cap reached — try again tomorrow");
      }
      setUnclaimed(0);
      qc.invalidateQueries({ queryKey: ["student", "wallet"] });
      qc.invalidateQueries({ queryKey: ["student", "wallet-full"] });
      qc.invalidateQueries({ queryKey: ["student", "wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["student", "activity"] });
    },
    onError: (e) => toast.error(e.message ?? "Claim failed"),
  });

  const claim = () => {
    if (unclaimed <= 0 || mut.isPending) return;
    const count = Math.min(unclaimed, PER_CLAIM_MAX);
    mut.mutate(count);
  };

  return { unclaimed, addWin: () => setUnclaimed((u) => u + 1), claim, claiming: mut.isPending };
}

function GameHeader({
  game,
  unclaimed,
  claim,
  claiming,
}: {
  game: Game;
  unclaimed: number;
  claim: () => void;
  claiming: boolean;
}) {
  const meta = GAME_META[game];
  const ds = DIFFICULTY_STYLE[meta.difficulty];
  const claimable = Math.min(unclaimed, PER_CLAIM_MAX);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.4px",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 999,
            background: ds.bg,
            color: ds.color,
            border: `1px solid ${ds.border}`,
          }}
        >
          {meta.difficulty}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
          {unclaimed > 0
            ? `🪙 ${unclaimed} unclaimed`
            : "Win rounds to earn coins"}
        </span>
      </div>
      <button
        onClick={claim}
        disabled={unclaimed === 0 || claiming}
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.2px",
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,205,0,0.45)",
          background:
            unclaimed === 0
              ? "rgba(255,255,255,0.06)"
              : "linear-gradient(135deg,#F59E0B,#FACC15)",
          color: unclaimed === 0 ? "rgba(255,255,255,0.4)" : "#1B0F02",
          cursor: unclaimed === 0 || claiming ? "not-allowed" : "pointer",
          opacity: claiming ? 0.7 : 1,
        }}
      >
        {claiming ? "Claiming…" : `🪙 Claim ${claimable} BT`}
      </button>
    </div>
  );
}

/* ─────────── Word Scramble ─────────── */

const SCRAMBLE_WORDS: { word: string; hint: string }[] = [
  { word: "EQUATION", hint: "Expressions linked by =" },
  { word: "VARIABLE", hint: "A letter that represents a number" },
  { word: "PRODUCT", hint: "Result of multiplication" },
  { word: "FACTOR", hint: "A number that divides another evenly" },
  { word: "COEFFICIENT", hint: "Number in front of a variable" },
  { word: "POLYNOMIAL", hint: "Expression with multiple terms" },
  { word: "QUADRATIC", hint: "Degree-2 equation" },
  { word: "FUNCTION", hint: "Maps each input to one output" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WordScramble({
  meetingId,
  classroomId,
}: {
  meetingId?: string;
  classroomId?: string;
}) {
  const { unclaimed, addWin, claim, claiming } = useGameClaim(
    "scramble",
    meetingId,
    classroomId,
  );
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
  const [tiles, setTiles] = useState<string[]>([]);

  const current = SCRAMBLE_WORDS[idx % SCRAMBLE_WORDS.length];

  useEffect(() => {
    setTiles(shuffle(current.word.split("")));
    setAnswer("");
    setStatus("playing");
  }, [idx, current.word]);

  const check = () => {
    if (answer.toUpperCase() === current.word) {
      setScore((s) => s + 1);
      setStatus("correct");
      addWin();
      toast.success("✓ Correct! +1 unclaimed coin");
      setTimeout(() => setIdx((i) => i + 1), 1000);
    } else {
      setStatus("wrong");
      toast.error("Not quite — try again");
      setTimeout(() => setStatus("playing"), 800);
    }
  };

  const skip = () => {
    toast.info(`Skipped: the word was ${current.word}`);
    setIdx((i) => i + 1);
  };

  return (
    <div className="gr-panel">
      <GameHeader game="scramble" unclaimed={unclaimed} claim={claim} claiming={claiming} />
      <div className="gr-scr-status">
        Round {idx + 1} · {current.hint}
      </div>
      <div className="gr-scr-tiles">
        {tiles.map((l, i) => (
          <span key={`${l}-${i}`} className="gr-scr-tile">
            {l}
          </span>
        ))}
      </div>
      <div className="gr-scr-ans-row">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Type your answer…"
          className="gr-scr-ans"
          autoFocus
          style={
            status === "correct"
              ? { borderColor: "#4AE8A0", background: "rgba(74,232,160,0.15)" }
              : status === "wrong"
                ? { borderColor: "#FF7080", background: "rgba(255,112,128,0.15)" }
                : undefined
          }
        />
        <button onClick={skip} className="gr-scr-clr">
          Skip
        </button>
        <button onClick={check} className="gr-scr-sub" disabled={!answer.trim()}>
          Check ✓
        </button>
      </div>
      <div className="gr-scr-score">
        Score: <b>{score}</b> · Word <span>{idx + 1}</span>
      </div>
    </div>
  );
}

/* ─────────── Memory Match ─────────── */

const MEMORY_PAIRS = ["⚖️", "📐", "🔢", "📊", "🎯", "🧮"];

type Card = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
};

function MemoryMatch({
  meetingId,
  classroomId,
}: {
  meetingId?: string;
  classroomId?: string;
}) {
  const { unclaimed, addWin, claim, claiming } = useGameClaim(
    "memory",
    meetingId,
    classroomId,
  );
  const [cards, setCards] = useState<Card[]>([]);
  const [picks, setPicks] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);

  const reset = () => {
    const deck = shuffle([...MEMORY_PAIRS, ...MEMORY_PAIRS]).map((e, i) => ({
      id: i,
      emoji: e,
      flipped: false,
      matched: false,
    }));
    setCards(deck);
    setPicks([]);
    setMoves(0);
    setMatched(0);
    setStartedAt(null);
    setElapsed(0);
    setWon(false);
  };

  useEffect(() => {
    reset();
  }, []);

  useEffect(() => {
    if (!startedAt || won) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [startedAt, won]);

  const flip = (id: number) => {
    if (picks.length >= 2) return;
    if (!startedAt) setStartedAt(Date.now());
    setCards((prev) =>
      prev.map((c) => (c.id === id && !c.matched ? { ...c, flipped: true } : c)),
    );
    setPicks((p) => [...p, id]);
  };

  useEffect(() => {
    if (picks.length !== 2) return;
    setMoves((m) => m + 1);
    const [a, b] = picks;
    const ca = cards.find((c) => c.id === a);
    const cb = cards.find((c) => c.id === b);
    if (ca && cb && ca.emoji === cb.emoji) {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === a || c.id === b ? { ...c, matched: true } : c,
          ),
        );
        setMatched((m) => m + 1);
        setPicks([]);
      }, 350);
    } else {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === a || c.id === b ? { ...c, flipped: false } : c,
          ),
        );
        setPicks([]);
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.length]);

  useEffect(() => {
    if (matched === MEMORY_PAIRS.length && matched > 0 && !won) {
      setWon(true);
      addWin();
      toast.success(`🎉 Won in ${moves} moves! +1 unclaimed coin`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, moves, won]);

  return (
    <div className="gr-panel">
      <GameHeader game="memory" unclaimed={unclaimed} claim={claim} claiming={claiming} />
      <div className="gr-mem-stats">
        <span>{moves} moves</span>
        <span>
          {matched}/{MEMORY_PAIRS.length} matched
        </span>
        <span>{elapsed}s</span>
      </div>
      <div className="gr-mem-grid">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`gr-mem-card${c.flipped ? " flipped" : ""}${c.matched ? " matched" : ""}`}
            onClick={() => !c.flipped && !c.matched && flip(c.id)}
            disabled={c.flipped || c.matched || picks.length >= 2}
          >
            {c.flipped || c.matched ? c.emoji : "?"}
          </button>
        ))}
      </div>
      <div className="gr-mem-actions">
        <button onClick={reset} className="gr-scr-sub">
          {won ? "🎮 Play again" : "↻ Restart"}
        </button>
      </div>
    </div>
  );
}

/* ─────────── Math Sprint ─────────── */

type Op = "+" | "−" | "×" | "÷";

function genProblem(): { a: number; b: number; op: Op; ans: number; text: string } {
  const op: Op = (["+", "−", "×", "÷"] as Op[])[Math.floor(Math.random() * 4)];
  let a: number, b: number, ans: number;
  switch (op) {
    case "+":
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      ans = a + b;
      break;
    case "−":
      a = Math.floor(Math.random() * 60) + 30;
      b = Math.floor(Math.random() * a);
      ans = a - b;
      break;
    case "×":
      a = Math.floor(Math.random() * 11) + 2;
      b = Math.floor(Math.random() * 11) + 2;
      ans = a * b;
      break;
    case "÷":
      b = Math.floor(Math.random() * 11) + 2;
      ans = Math.floor(Math.random() * 11) + 2;
      a = b * ans;
      break;
  }
  return { a, b, op, ans, text: `${a} ${op} ${b}` };
}

function MathSprint({
  meetingId,
  classroomId,
}: {
  meetingId?: string;
  classroomId?: string;
}) {
  const SPRINT_SECONDS = 60;
  const { unclaimed, addWin, claim, claiming } = useGameClaim(
    "sprint",
    meetingId,
    classroomId,
  );
  const [problem, setProblem] = useState(() => genProblem());
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [missed, setMissed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(SPRINT_SECONDS);
  const [awardedThisRun, setAwardedThisRun] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      // Award one coin per completed sprint where the student solved >= 5
      // problems. Capped at 1/run so the timer doesn't farm BT.
      if (!awardedThisRun && solved >= 5) {
        addWin();
        setAwardedThisRun(true);
        toast.success(`⏱ Time! Score ${score} · +1 unclaimed coin`);
      } else {
        toast.success(`⏱ Time! Score ${score} · best streak ${bestStreak}`);
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remaining, score, bestStreak, solved, awardedThisRun]);

  const start = () => {
    setProblem(genProblem());
    setAnswer("");
    setScore(0);
    setSolved(0);
    setMissed(0);
    setStreak(0);
    setBestStreak(0);
    setRemaining(SPRINT_SECONDS);
    setRunning(true);
    setAwardedThisRun(false);
  };

  const submit = () => {
    if (!running) return;
    const guess = Number(answer.trim());
    if (Number.isNaN(guess)) return;
    if (guess === problem.ans) {
      const nextStreak = streak + 1;
      setScore((s) => s + (nextStreak >= 5 ? 2 : 1));
      setSolved((n) => n + 1);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
    } else {
      setMissed((n) => n + 1);
      setStreak(0);
    }
    setProblem(genProblem());
    setAnswer("");
  };

  const accuracy = solved + missed > 0 ? Math.round((solved / (solved + missed)) * 100) : 0;

  return (
    <div className="gr-panel">
      <GameHeader game="sprint" unclaimed={unclaimed} claim={claim} claiming={claiming} />
      <div className="gr-mem-stats">
        <span>⏱ {remaining}s</span>
        <span>🔥 streak {streak}</span>
        <span>✓ {solved} · ✗ {missed}</span>
      </div>
      <div className="gr-scr-status">
        {running
          ? "Solve as many as you can — solve 5+ to earn a coin"
          : remaining === 0
            ? `Round over — accuracy ${accuracy}%`
            : "Tap Start, then type the answer and press Enter"}
      </div>
      <div className="gr-scr-tiles" style={{ minHeight: 56 }}>
        <span className="gr-scr-tile" style={{ width: "auto", padding: "0 16px", fontSize: 22 }}>
          {problem.text} = ?
        </span>
      </div>
      <div className="gr-scr-ans-row">
        <input
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={running ? "Answer…" : "Press Start"}
          className="gr-scr-ans"
          disabled={!running}
          style={{ textTransform: "none", letterSpacing: 0 }}
        />
        <button onClick={submit} className="gr-scr-sub" disabled={!running || !answer.trim()}>
          Enter ✓
        </button>
        <button onClick={start} className="gr-scr-clr">
          {running ? "Reset" : remaining === 0 ? "Play again" : "Start"}
        </button>
      </div>
      <div className="gr-scr-score">
        Score: <b>{score}</b> · Best streak <span>{bestStreak}</span>
      </div>
    </div>
  );
}

/* ─────────── Number Sequence ─────────── */

const SEQUENCES: { terms: number[]; next: number; rule: string }[] = [
  { terms: [2, 4, 6, 8], next: 10, rule: "Add 2 each step" },
  { terms: [3, 6, 9, 12], next: 15, rule: "Multiples of 3" },
  { terms: [1, 4, 9, 16], next: 25, rule: "Square numbers (n²)" },
  { terms: [1, 1, 2, 3, 5], next: 8, rule: "Fibonacci — sum of last two" },
  { terms: [2, 4, 8, 16], next: 32, rule: "Double the previous" },
  { terms: [5, 10, 20, 40], next: 80, rule: "Geometric ×2" },
  { terms: [1, 3, 6, 10], next: 15, rule: "Triangular numbers" },
  { terms: [100, 90, 80, 70], next: 60, rule: "Subtract 10" },
];

function NumberSequence({
  meetingId,
  classroomId,
}: {
  meetingId?: string;
  classroomId?: string;
}) {
  const { unclaimed, addWin, claim, claiming } = useGameClaim(
    "sequence",
    meetingId,
    classroomId,
  );
  const order = useMemo(() => shuffle([...Array(SEQUENCES.length).keys()]), []);
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showRule, setShowRule] = useState(false);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");

  const current = SEQUENCES[order[pos % order.length]];
  const round = pos + 1;
  const total = SEQUENCES.length;
  const finished = pos >= total;

  const advance = () => {
    setAnswer("");
    setShowRule(false);
    setStatus("playing");
    setPos((p) => p + 1);
  };

  const check = () => {
    if (Number(answer.trim()) === current.next) {
      setScore((s) => s + (showRule ? 1 : 2));
      setStatus("correct");
      addWin();
      toast.success(showRule ? "✓ Correct (+1 coin)" : "✓ Correct (+1 coin, +2 pts)");
      setTimeout(advance, 800);
    } else {
      setStatus("wrong");
      toast.error("Not quite — try again");
      setTimeout(() => setStatus("playing"), 700);
    }
  };

  const skip = () => {
    toast.info(`Answer was ${current.next} — ${current.rule}`);
    advance();
  };

  const reset = () => {
    setPos(0);
    setScore(0);
    setAnswer("");
    setShowRule(false);
    setStatus("playing");
  };

  if (finished) {
    return (
      <div className="gr-panel">
        <GameHeader game="sequence" unclaimed={unclaimed} claim={claim} claiming={claiming} />
        <div className="gr-scr-status">🎉 All sequences cleared</div>
        <div className="gr-scr-score">
          Final score: <b>{score}</b> / {total * 2}
        </div>
        <div className="gr-mem-actions">
          <button onClick={reset} className="gr-scr-sub">
            🎮 Play again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gr-panel">
      <GameHeader game="sequence" unclaimed={unclaimed} claim={claim} claiming={claiming} />
      <div className="gr-scr-status">
        Round {round} / {total} — what comes next?
      </div>
      <div className="gr-scr-tiles">
        {current.terms.map((n, i) => (
          <span key={i} className="gr-scr-tile">
            {n}
          </span>
        ))}
        <span
          className="gr-scr-tile"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
        >
          ?
        </span>
      </div>
      {showRule && (
        <div className="gr-scr-status" style={{ color: "rgba(255,208,96,0.9)" }}>
          Hint: {current.rule}
        </div>
      )}
      <div className="gr-scr-ans-row">
        <input
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Next number…"
          className="gr-scr-ans"
          autoFocus
          style={
            status === "correct"
              ? { borderColor: "#4AE8A0", background: "rgba(74,232,160,0.15)", textTransform: "none", letterSpacing: 0 }
              : status === "wrong"
                ? { borderColor: "#FF7080", background: "rgba(255,112,128,0.15)", textTransform: "none", letterSpacing: 0 }
                : { textTransform: "none", letterSpacing: 0 }
          }
        />
        <button
          onClick={() => setShowRule(true)}
          className="gr-scr-clr"
          disabled={showRule}
          title="Reveal the rule (-1 to round value)"
        >
          Hint
        </button>
        <button onClick={skip} className="gr-scr-clr">
          Skip
        </button>
        <button onClick={check} className="gr-scr-sub" disabled={!answer.trim()}>
          Check ✓
        </button>
      </div>
      <div className="gr-scr-score">
        Score: <b>{score}</b> · Round <span>{round}/{total}</span>
      </div>
    </div>
  );
}
