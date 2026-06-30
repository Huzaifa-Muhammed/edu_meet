"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SYLLABI, GRADES } from "@/shared/constants/curriculum";

const OTHER = "__other__";
const has = (arr: string[], v: string) =>
  arr.some((x) => x.toLowerCase() === v.toLowerCase());

/**
 * Single-select exam board ("syllabus") dropdown + "Other…" free-text escape
 * hatch. Controlled: pass `value` + `onChange`. Styling defaults to semantic
 * tokens (works on every portal scope); override via `selectClassName` to match
 * a specific form's inputs.
 */
export function SyllabusSelect({
  value,
  onChange,
  id,
  className,
  selectClassName = "w-full rounded-lg border border-bd bg-surf px-3 py-2 text-sm text-t outline-none focus:border-acc",
  placeholder = "Select exam board…",
}: {
  value?: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
  selectClassName?: string;
  placeholder?: string;
}) {
  const presetNames = SYLLABI.map((s) => s.name);
  const startsCustom = !!value && !presetNames.includes(value);
  const [custom, setCustom] = useState(startsCustom);

  return (
    <div className={className}>
      <select
        id={id}
        value={custom ? OTHER : value ?? ""}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className={selectClassName}
      >
        <option value="">{placeholder}</option>
        {SYLLABI.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {custom && (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type exam board…"
          className={`mt-2 ${selectClassName}`}
        />
      )}
    </div>
  );
}

/**
 * Multi-select exam boards as toggle chips + a free-text "add another" input.
 * Controlled: `value: string[]` + `onChange`. No internal save button — the
 * parent form owns submission.
 */
export function SyllabusMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const toggle = (name: string) =>
    onChange(
      has(value, name)
        ? value.filter((v) => v.toLowerCase() !== name.toLowerCase())
        : [...value, name],
    );
  const addCustom = () => {
    const s = custom.trim();
    if (s && !has(value, s)) onChange([...value, s]);
    setCustom("");
  };

  const options = [...SYLLABI.map((s) => s.name), ...value.filter((v) => !has(SYLLABI.map((s) => s.name), v))];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((name) => {
          const on = has(value, name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-acc bg-acc text-white"
                  : "border-bd bg-surf text-t2 hover:border-bd2"
              }`}
            >
              {on && <Check className="h-3 w-3" />}
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), addCustom())
          }
          placeholder="Add another board…"
          className="flex-1 rounded-lg border border-bd bg-surf px-3 py-1.5 text-xs text-t outline-none focus:border-acc"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-bd px-3 py-1.5 text-xs font-medium text-t2 hover:bg-panel"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/** Multi-select grade levels (1–12) as toggle chips. Controlled `number[]`. */
export function GradeMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (g: number) =>
    onChange(value.includes(g) ? value.filter((v) => v !== g) : [...value, g].sort((a, b) => a - b));
  return (
    <div className="flex flex-wrap gap-2">
      {GRADES.map((g) => {
        const on = value.includes(g);
        return (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            className={`min-w-[2.25rem] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              on
                ? "border-acc bg-acc text-white"
                : "border-bd bg-surf text-t2 hover:border-bd2"
            }`}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
