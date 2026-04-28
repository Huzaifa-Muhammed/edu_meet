"use client";

import type { ReactNode } from "react";

interface ThreeColumnShellProps {
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
}

/**
 * Grid shell matching the mockup layout:
 * sidenav (52px) | left panel (272px) | main (1fr) | right/copilot (282px)
 *
 * The sidenav and topbar are handled by the parent layout.
 * This component lays out the three content columns below the topbar.
 */
export function ThreeColumnShell({ left, main, right }: ThreeColumnShellProps) {
  return (
    <div
      className="grid flex-1 overflow-hidden"
      style={{
        gridTemplateColumns: left
          ? right
            ? "272px 1fr 282px"
            : "272px 1fr"
          : right
            ? "1fr 282px"
            : "1fr",
      }}
    >
      {left && (
        <aside className="flex flex-col overflow-hidden border-r border-sidebd bg-side">
          {left}
        </aside>
      )}
      <main className="relative z-[5] flex flex-col overflow-hidden bg-surf shadow-[0_0_0_1px_var(--bd),4px_0_24px_rgba(0,0,0,.08),-4px_0_24px_rgba(0,0,0,.08)]">
        {main}
      </main>
      {right && (
        <aside className="flex flex-col overflow-hidden border-l border-cpbd bg-cp">
          {right}
        </aside>
      )}
    </div>
  );
}
