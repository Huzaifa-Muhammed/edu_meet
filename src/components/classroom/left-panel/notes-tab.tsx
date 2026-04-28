"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface NotesTabProps {
  meetingId: string;
}

const mockNotes = [
  {
    id: "n1",
    tag: "Definition",
    tagColor: "bg-bbg text-bt",
    time: "10:12",
    text: "An equation: two expressions equal, linked by =.",
    code: "2x + 3 = 11",
  },
  {
    id: "n2",
    tag: "Method",
    tagColor: "bg-gbg text-gt",
    time: "10:24",
    text: "Isolate the variable using inverse operations on both sides.",
    code: "2x + 6 = 14 → x = 4",
  },
  {
    id: "n3",
    tag: "Overview",
    tagColor: "bg-pbg text-pt",
    time: "10:31",
    text: "Three solution types: one, none, or infinitely many solutions.",
  },
];

export function NotesTab({ meetingId }: NotesTabProps) {
  const [noteText, setNoteText] = useState("");

  return (
    <div className="p-3.5">
      {/* Input */}
      <div className="mb-3 flex gap-1.5">
        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Quick note..."
          className="flex-1 rounded-lg border border-bd bg-surf px-2.5 py-1.5 text-[11px] text-t outline-none placeholder:text-t3"
        />
        <button className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-acc text-white">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Notes list */}
      {mockNotes.map((note) => (
        <div
          key={note.id}
          className="mb-1.5 rounded-[9px] border border-bd bg-surf p-2.5"
        >
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${note.tagColor}`}
            >
              {note.tag}
            </span>
            <span className="text-[10px] text-t3">{note.time}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-t2">{note.text}</p>
          {note.code && (
            <code className="mt-1 inline-block rounded bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-blue">
              {note.code}
            </code>
          )}
        </div>
      ))}
    </div>
  );
}
