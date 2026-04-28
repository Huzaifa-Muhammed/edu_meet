"use client";

interface ResourcesTabProps {
  meetingId: string;
}

const mockResources = [
  {
    section: "Tools",
    items: [
      {
        id: "r1",
        icon: "🖊",
        iconBg: "bg-bbg",
        title: "Writing board",
        subtitle: "Collaborative whiteboard",
        action: "Launch",
      },
      {
        id: "r2",
        icon: "📊",
        iconBg: "bg-pbg",
        title: "Graphing calculator",
        subtitle: "Desmos embedded",
        action: "Open",
      },
    ],
  },
  {
    section: "Documents",
    items: [
      {
        id: "r3",
        icon: "📄",
        iconBg: "bg-rbg",
        title: "Chapter 3 worksheet",
        subtitle: "PDF · 4 pages",
        action: "Download",
      },
    ],
  },
  {
    section: "Links",
    items: [
      {
        id: "r4",
        icon: "🔗",
        iconBg: "bg-gbg",
        title: "Khan Academy",
        subtitle: "One-variable equations",
        action: "Open",
      },
    ],
  },
];

export function ResourcesTab({ meetingId }: ResourcesTabProps) {
  return (
    <div className="p-3.5">
      {mockResources.map((section) => (
        <div key={section.section}>
          <div className="mb-1.5 mt-2.5 text-[9px] font-semibold uppercase tracking-widest text-t3 first:mt-0">
            {section.section}
          </div>
          {section.items.map((item) => (
            <div
              key={item.id}
              className="mb-1.5 rounded-[9px] border border-bd bg-surf p-2.5"
            >
              <div className="mb-2 flex gap-2.5">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-sm ${item.iconBg}`}
                >
                  {item.icon}
                </div>
                <div>
                  <div className="text-[11px] font-medium">{item.title}</div>
                  <div className="text-[10px] text-t3">{item.subtitle}</div>
                </div>
              </div>
              <button className="w-full rounded-md border border-bd2 bg-transparent py-1 text-[10px] font-medium text-t2 transition-colors hover:bg-panel">
                {item.action}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
