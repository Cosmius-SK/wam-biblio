"use client";

import { useState, type ReactNode } from "react";

/**
 * The owner page, in rooms rather than one long scroll.
 *
 * It accumulated a section at a time — numbers, invitations, connection checks,
 * a first-run preview, messages — and each addition was reasonable while the
 * whole became a thing you scroll past looking for the bit you wanted.
 *
 * Everything is rendered on the server as before; this only decides what is on
 * screen, so switching costs nothing and no data is fetched twice.
 */
export interface OwnerSection {
  id: string;
  label: string;
  content: ReactNode;
}

export default function OwnerTabs({ sections }: { sections: OwnerSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="mt-6">
      <nav
        aria-label="Owner sections"
        className="flex w-full gap-1 overflow-x-auto rounded-full border border-hairline/70 bg-surface/60 p-1 backdrop-blur-sm"
      >
        {sections.map((s) => {
          const on = s.id === current?.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                on ? "bg-ink/90 text-paper shadow-soft" : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
