"use client";

import { Plus, Users, Clock, ArrowLeft } from "lucide-react";

interface BreakoutPaneProps {
  meetingId: string;
}

const mockRooms = [
  { id: "r1", name: "Room 1", students: ["Amir K.", "Priya S.", "Jordan L."], timer: "8:30" },
  { id: "r2", name: "Room 2", students: ["Maya R.", "Liam C.", "Sarah W."], timer: "8:30" },
  { id: "r3", name: "Room 3", students: ["Ethan B.", "Noor A."], timer: "8:30" },
];

export function BreakoutPane({ meetingId }: BreakoutPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-t">Breakout Rooms</h3>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-bd px-3 py-1.5 text-[11px] font-medium text-t2 transition-colors hover:bg-panel">
            <ArrowLeft className="h-3 w-3" />
            Recall All
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-acc px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90">
            <Plus className="h-3 w-3" />
            Create Room
          </button>
        </div>
      </div>

      {/* Rooms grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mockRooms.map((room) => (
          <div
            key={room.id}
            className="rounded-xl border border-bd bg-surf p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-t">{room.name}</h4>
              <div className="flex items-center gap-1 text-[10px] text-t3">
                <Clock className="h-3 w-3" />
                {room.timer}
              </div>
            </div>
            <div className="space-y-1">
              {room.students.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 text-[11px] text-t2"
                >
                  <Users className="h-3 w-3 text-t3" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
