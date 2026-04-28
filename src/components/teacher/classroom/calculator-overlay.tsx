"use client";

import { useEffect, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { X, Calculator as CalcIcon } from "lucide-react";

/** Scientific calculator overlay. State (display, expression, memory) is
 *  synced across all participants via pubsub so students see the teacher's
 *  calculator live. Students see a read-only view of the same calculator. */
type CalcState = {
  expr: string;
  result: string;
  isRad: boolean;
};

const INITIAL: CalcState = { expr: "", result: "0", isRad: true };

export function CalculatorOverlay({
  onClose,
  canEdit,
  open,
}: {
  onClose: () => void;
  canEdit: boolean;
  open: boolean;
}) {
  const [state, setState] = useState<CalcState>(INITIAL);

  const { publish: publishCalc, messages: calcMsgs } = usePubSub("CALC");
  const { publish: publishOpen, messages: openMsgs } = usePubSub("CALC_OPEN");

  // Teacher publishes open/close state so students auto-open/close
  useEffect(() => {
    if (!canEdit) return;
    publishOpen(JSON.stringify({ open, ts: Date.now() }), { persist: true });
  }, [open, canEdit, publishOpen]);

  // Non-editors: read latest calc state from pubsub
  useEffect(() => {
    if (canEdit) return;
    const last = calcMsgs[calcMsgs.length - 1];
    if (!last) return;
    try {
      const s = JSON.parse(last.message as unknown as string) as CalcState;
      setState(s);
    } catch {
      // skip
    }
  }, [calcMsgs.length, canEdit]);

  // Teacher: broadcast state on each change
  useEffect(() => {
    if (!canEdit) return;
    publishCalc(JSON.stringify(state), { persist: true });
  }, [state, canEdit, publishCalc]);

  // Keyboard input for teacher
  useEffect(() => {
    if (!open || !canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if ("0123456789".includes(e.key)) append(e.key);
      else if (["+", "-", "*", "/", "(", ")", ".", "%"].includes(e.key)) append(e.key);
      else if (e.key === "Enter" || e.key === "=") evaluate();
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canEdit, state]);

  // ignore openMsgs for teacher. Student side would read them; student page not built.
  void openMsgs;

  if (!open) return null;

  const append = (t: string) => {
    if (!canEdit) return;
    setState((s) => ({ ...s, expr: (s.expr ?? "") + t }));
  };
  const backspace = () => {
    if (!canEdit) return;
    setState((s) => ({ ...s, expr: s.expr.slice(0, -1) }));
  };
  const clear = () => {
    if (!canEdit) return;
    setState(() => ({ ...INITIAL, isRad: state.isRad }));
  };
  const evaluate = () => {
    if (!canEdit) return;
    try {
      const out = safeEvaluate(state.expr, state.isRad);
      setState((s) => ({ ...s, result: formatResult(out) }));
    } catch {
      setState((s) => ({ ...s, result: "Error" }));
    }
  };
  const toggleRad = () =>
    setState((s) => ({ ...s, isRad: !s.isRad }));

  return (
    <div
      className="absolute inset-0 z-[12] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.4)" }}
    >
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "#1E293B" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <CalcIcon className="h-4 w-4 text-white/80" />
          <span className="flex-1 text-[13px] font-semibold text-white">
            Scientific calculator
          </span>
          {!canEdit && (
            <span className="rounded-md bg-purple-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.3px] text-purple-100">
              Teacher view
            </span>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Display */}
        <div className="px-4 py-3" style={{ background: "#0F172A" }}>
          <div
            className="min-h-[22px] text-right font-mono text-[14px] text-white/50"
            style={{ wordBreak: "break-all" }}
          >
            {state.expr || <span className="opacity-40">0</span>}
          </div>
          <div
            className="mt-1 text-right font-mono text-[28px] font-semibold text-white"
            style={{ wordBreak: "break-all" }}
          >
            {state.result}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-6 gap-1.5 p-3">
          {/* Row 1 — mode toggle + clear + back + divide */}
          <Btn onClick={toggleRad} variant="mode" disabled={!canEdit}>
            {state.isRad ? "RAD" : "DEG"}
          </Btn>
          <Btn onClick={() => append("PI")} variant="fn" disabled={!canEdit}>
            π
          </Btn>
          <Btn onClick={() => append("E")} variant="fn" disabled={!canEdit}>
            e
          </Btn>
          <Btn onClick={clear} variant="warn" disabled={!canEdit}>
            C
          </Btn>
          <Btn onClick={backspace} variant="warn" disabled={!canEdit}>
            ⌫
          </Btn>
          <Btn onClick={() => append("/")} variant="op" disabled={!canEdit}>
            ÷
          </Btn>

          {/* Row 2 — trig + 7/8/9 + * */}
          <Btn onClick={() => append("sin(")} variant="fn" disabled={!canEdit}>
            sin
          </Btn>
          <Btn onClick={() => append("cos(")} variant="fn" disabled={!canEdit}>
            cos
          </Btn>
          <Btn onClick={() => append("tan(")} variant="fn" disabled={!canEdit}>
            tan
          </Btn>
          <Btn onClick={() => append("7")} disabled={!canEdit}>7</Btn>
          <Btn onClick={() => append("8")} disabled={!canEdit}>8</Btn>
          <Btn onClick={() => append("9")} disabled={!canEdit}>9</Btn>

          {/* Row 3 — log/ln + 4/5/6 + - */}
          <Btn onClick={() => append("log(")} variant="fn" disabled={!canEdit}>
            log
          </Btn>
          <Btn onClick={() => append("ln(")} variant="fn" disabled={!canEdit}>
            ln
          </Btn>
          <Btn onClick={() => append("sqrt(")} variant="fn" disabled={!canEdit}>
            √
          </Btn>
          <Btn onClick={() => append("4")} disabled={!canEdit}>4</Btn>
          <Btn onClick={() => append("5")} disabled={!canEdit}>5</Btn>
          <Btn onClick={() => append("6")} disabled={!canEdit}>6</Btn>

          {/* Row 4 — pow + factorial + mod + 1/2/3 + + */}
          <Btn onClick={() => append("^")} variant="fn" disabled={!canEdit}>
            x^y
          </Btn>
          <Btn onClick={() => append("!")} variant="fn" disabled={!canEdit}>
            x!
          </Btn>
          <Btn onClick={() => append("%")} variant="fn" disabled={!canEdit}>
            %
          </Btn>
          <Btn onClick={() => append("1")} disabled={!canEdit}>1</Btn>
          <Btn onClick={() => append("2")} disabled={!canEdit}>2</Btn>
          <Btn onClick={() => append("3")} disabled={!canEdit}>3</Btn>

          {/* Row 5 — parens + 0 + . + = */}
          <Btn onClick={() => append("(")} variant="op" disabled={!canEdit}>
            (
          </Btn>
          <Btn onClick={() => append(")")} variant="op" disabled={!canEdit}>
            )
          </Btn>
          <Btn onClick={() => append("*")} variant="op" disabled={!canEdit}>
            ×
          </Btn>
          <Btn onClick={() => append("-")} variant="op" disabled={!canEdit}>
            −
          </Btn>
          <Btn onClick={() => append("+")} variant="op" disabled={!canEdit}>
            +
          </Btn>
          <Btn onClick={evaluate} variant="equals" disabled={!canEdit}>
            =
          </Btn>

          {/* Row 6 — 0 . */}
          <Btn onClick={() => append("0")} disabled={!canEdit} span={4}>0</Btn>
          <Btn onClick={() => append(".")} disabled={!canEdit}>.</Btn>
          <Btn onClick={() => append(",")} disabled={!canEdit}>,</Btn>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "num",
  disabled,
  span,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "op" | "fn" | "equals" | "warn" | "mode";
  disabled?: boolean;
  span?: number;
}) {
  const base =
    "flex items-center justify-center rounded-lg px-2 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40";
  const styles = {
    num: "bg-slate-700 text-white hover:bg-slate-600",
    op: "bg-slate-600 text-white hover:bg-slate-500",
    fn: "bg-slate-800 text-purple-200 hover:bg-slate-700 text-[11px]",
    equals: "bg-blue-600 text-white hover:bg-blue-500",
    warn: "bg-red-500/20 text-red-200 hover:bg-red-500/40",
    mode: "bg-slate-800 text-amber-200 hover:bg-slate-700 text-[11px]",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={span ? { gridColumn: `span ${span} / span ${span}` } : undefined}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}

/* ─── Safe expression eval — rejects anything other than math ─── */

function safeEvaluate(raw: string, isRad: boolean): number {
  // Replace unicode / human chars → JS equivalents
  const src = raw
    .replace(/π/g, "PI")
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/\^/g, "**")
    .replace(/Math\.PI/g, "PI")
    .replace(/Math\.E/g, "E")
    .trim();

  // Factorial: n!
  const withFactorial = src.replace(/(\d+(?:\.\d+)?)!/g, (_m, n) => `fact(${n})`);

  // Whitelist: only digits, operators, parens, dot, comma, whitespace, and our
  // explicit allow-listed identifiers. Anything else = reject.
  const allowedIdents = new Set([
    "PI",
    "E",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "log",
    "ln",
    "sqrt",
    "abs",
    "pow",
    "fact",
  ]);
  // Strip all numbers/operators/parens, then check every remaining identifier
  // is allow-listed.
  const stripped = withFactorial.replace(/[0-9+\-*/%().,\s]|\*\*/g, " ");
  const idents = stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const id of idents) {
    if (!allowedIdents.has(id)) {
      throw new Error(`Unsafe identifier: ${id}`);
    }
  }

  // Locally provide the math helpers; wrap trig args by angle mode
  const deg = (d: number) => (d * Math.PI) / 180;
  const sin = (x: number) => Math.sin(isRad ? x : deg(x));
  const cos = (x: number) => Math.cos(isRad ? x : deg(x));
  const tan = (x: number) => Math.tan(isRad ? x : deg(x));
  const asin = (x: number) => (isRad ? Math.asin(x) : (Math.asin(x) * 180) / Math.PI);
  const acos = (x: number) => (isRad ? Math.acos(x) : (Math.acos(x) * 180) / Math.PI);
  const atan = (x: number) => (isRad ? Math.atan(x) : (Math.atan(x) * 180) / Math.PI);
  const log = (x: number) => Math.log10(x);
  const ln = (x: number) => Math.log(x);
  const sqrt = (x: number) => Math.sqrt(x);
  const abs = (x: number) => Math.abs(x);
  const pow = (x: number, y: number) => Math.pow(x, y);
  const fact = (n: number) => {
    if (n < 0 || !Number.isFinite(n)) return NaN;
    let r = 1;
    for (let i = 2; i <= Math.floor(n); i++) r *= i;
    return r;
  };
  const PI = Math.PI;
  const E = Math.E;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function(
    "PI",
    "E",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "log",
    "ln",
    "sqrt",
    "abs",
    "pow",
    "fact",
    `"use strict"; return (${withFactorial || 0});`,
  );
  const out = fn(
    PI,
    E,
    sin,
    cos,
    tan,
    asin,
    acos,
    atan,
    log,
    ln,
    sqrt,
    abs,
    pow,
    fact,
  );
  if (typeof out !== "number" || !Number.isFinite(out)) throw new Error("Bad result");
  return out;
}

function formatResult(n: number): string {
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) {
    return n.toExponential(6);
  }
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

