"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { Check } from "lucide-react";
import type { Subject } from "@/shared/types/domain";

const DEFAULT_FALLBACK = [
  "Math",
  "English",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Computer Science",
  "Art",
];

export function SubjectPicker({
  selected,
  onSave,
  allowFreeText = true,
  invalidateUserQuery = false,
}: {
  selected: string[];
  onSave: (subjects: string[]) => Promise<unknown>;
  allowFreeText?: boolean;
  invalidateUserQuery?: boolean;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => setPicked(selected), [selected]);

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/subjects") as unknown as Promise<Subject[]>,
  });

  const options = (subjects?.map((s) => s.name) ?? []).concat(
    subjects?.length ? [] : DEFAULT_FALLBACK,
  );

  const toggle = (name: string) =>
    setPicked((cur) =>
      cur.some((c) => c.toLowerCase() === name.toLowerCase())
        ? cur.filter((c) => c.toLowerCase() !== name.toLowerCase())
        : [...cur, name],
    );

  const addCustom = () => {
    const s = custom.trim();
    if (!s) return;
    if (!picked.some((p) => p.toLowerCase() === s.toLowerCase())) {
      setPicked([...picked, s]);
    }
    setCustom("");
  };

  async function save() {
    setSaving(true);
    try {
      await onSave(picked);
      toast.success("Subjects saved");
      if (invalidateUserQuery) {
        qc.invalidateQueries({ queryKey: ["user"] });
        window.location.reload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((name) => {
          const on = picked.some((p) => p.toLowerCase() === name.toLowerCase());
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

      {allowFreeText && (
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            placeholder="Add another subject…"
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
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-lg bg-acc px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save subjects"}
      </button>
    </div>
  );
}
