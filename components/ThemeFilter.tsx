"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { JournalEntry } from "@/lib/types";
import { groupByTheme, moodDistribution } from "@/lib/organize";

export interface FilterValue {
  kind: "theme" | "mood";
  value: string;
}

/** True when the entry matches the active filter (or there is none). */
export function matchesFilter(entry: JournalEntry, filter: FilterValue | null): boolean {
  if (!filter) return true;
  if (filter.kind === "mood") return entry.mood.toLowerCase() === filter.value.toLowerCase();
  return entry.themes.some((t) => t.toLowerCase() === filter.value.toLowerCase());
}

/**
 * A quiet, collapsible filter over themes and moods — the essence of the old
 * Themes tab, tucked inside Timeline and Gallery. Collapsed it's one row;
 * expanded it offers every chip; an active choice shows with a one-tap clear.
 */
export default function ThemeFilter({
  entries,
  value,
  onChange,
}: {
  entries: JournalEntry[];
  value: FilterValue | null;
  onChange: (v: FilterValue | null) => void;
}) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;
  const clusters = groupByTheme(entries);
  const moods = moodDistribution(entries);

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/60 px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filter
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-paper ${
              value.kind === "mood" ? "bg-lavender" : "bg-sage"
            }`}
          >
            {value.value}
            <span aria-hidden>✕</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-hairline/60 bg-surface/50 p-4">
              {moods.length > 0 && (
                <>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted/70">Moods</p>
                  <div className="flex flex-wrap gap-2">
                    {moods.map((m) => {
                      const active = value?.kind === "mood" && value.value === m.mood;
                      return (
                        <button
                          key={m.mood}
                          type="button"
                          onClick={() =>
                            onChange(active ? null : { kind: "mood", value: m.mood })
                          }
                          className={`rounded-full px-3 py-1 text-sm transition-colors ${
                            active
                              ? "bg-lavender text-paper"
                              : "bg-lavender/12 text-lavender hover:bg-lavender/25"
                          }`}
                        >
                          {m.mood} <span className="opacity-60">· {m.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {clusters.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-muted/70">Themes</p>
                  <div className="flex flex-wrap gap-2">
                    {clusters.map((c) => {
                      const active = value?.kind === "theme" && value.value === c.theme;
                      return (
                        <button
                          key={c.theme}
                          type="button"
                          onClick={() =>
                            onChange(active ? null : { kind: "theme", value: c.theme })
                          }
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            active ? "bg-sage text-paper" : "bg-sage/15 text-sage hover:bg-sage/25"
                          }`}
                        >
                          {c.theme} <span className="opacity-60">· {c.entries.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
