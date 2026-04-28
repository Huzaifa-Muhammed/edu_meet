"use client";

import { cn } from "@/lib/utils/cn";

interface AttendeesPaneProps {
  meetingId: string;
}

const mockStudents = [
  { id: "1", name: "Amir K.", initials: "AK", color: "bg-bbg text-bt", attention: "hi" as const },
  { id: "2", name: "Priya S.", initials: "PS", color: "bg-gbg text-gt", attention: "hi" as const },
  { id: "3", name: "Jordan L.", initials: "JL", color: "bg-pbg text-pt", attention: "md" as const },
  { id: "4", name: "Maya R.", initials: "MR", color: "bg-abg text-at", attention: "hi" as const },
  { id: "5", name: "Liam C.", initials: "LC", color: "bg-rbg text-rt", attention: "lo" as const },
  { id: "6", name: "Sarah W.", initials: "SW", color: "bg-bbg text-bt", attention: "hi" as const },
  { id: "7", name: "Ethan B.", initials: "EB", color: "bg-gbg text-gt", attention: "md" as const },
  { id: "8", name: "Noor A.", initials: "NA", color: "bg-pbg text-pt", attention: "hi" as const },
];

const attColors = {
  hi: "bg-gbg text-gt border-gbd",
  md: "bg-abg text-at border-abd",
  lo: "bg-rbg text-rt border-rbd",
};

const attLabels = { hi: "Active", md: "Moderate", lo: "Away" };

export function AttendeesPane({ meetingId }: AttendeesPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Legend */}
      <div className="flex gap-2.5 border-b border-bd px-3 py-1.5">
        {(["hi", "md", "lo"] as const).map((level) => (
          <div key={level} className="flex items-center gap-1 text-[9px] text-t3">
            <div
              className={cn(
                "h-[5px] w-[5px] rounded-full",
                level === "hi"
                  ? "bg-green"
                  : level === "md"
                    ? "bg-amber"
                    : "bg-red",
              )}
            />
            {attLabels[level]}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-1.5 overflow-y-auto p-2.5">
        {mockStudents.map((s) => (
          <div
            key={s.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-bd bg-surf p-2 transition-all hover:border-bd2 hover:bg-panel"
          >
            <div
              className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${s.color}`}
            >
              {s.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium">{s.name}</div>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase ${attColors[s.attention]}`}
              >
                {attLabels[s.attention]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
