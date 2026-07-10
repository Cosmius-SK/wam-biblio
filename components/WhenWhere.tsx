"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EntryPlace } from "@/lib/types";
import { searchPlaces, placeLabel } from "@/lib/geo";

/** "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, in local time. */
export function nowForInput(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The "when & where" of a thought. Date/time defaults to now (local) and can
 * be set to any past moment; the place is chosen from real geocoding results —
 * typed queries only ever *search*, never save as free text.
 */
export default function WhenWhere({
  when,
  onWhenChange,
  place,
  onPlaceChange,
}: {
  when: string;
  onWhenChange: (v: string) => void;
  place: EntryPlace | null;
  onPlaceChange: (p: EntryPlace | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntryPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced place search.
  useEffect(() => {
    abortRef.current?.abort();
    setSearchError(false);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, ctrl.signal);
        setResults(found);
        setSearching(false);
        if (found.length === 0) setSearchError(true);
      } catch {
        if (!ctrl.signal.aborted) {
          setResults([]);
          setSearching(false);
          setSearchError(true);
        }
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function pick(p: EntryPlace) {
    onPlaceChange(p);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="mt-5 rounded-2xl border border-hairline/70 bg-surface/50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex-1">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">When</span>
          <input
            type="datetime-local"
            value={when}
            max={nowForInput()}
            onChange={(e) => onWhenChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-hairline bg-paper/50 px-3 py-2 text-sm text-ink focus:border-lavender/60"
          />
        </label>

        <div className="relative flex-1">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">Where</span>
          {place ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-paper/50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
                <PinIcon />
                <span className="truncate">{placeLabel(place)}</span>
              </span>
              <button
                type="button"
                onClick={() => onPlaceChange(null)}
                aria-label="Remove place"
                className="shrink-0 rounded-full px-1.5 text-muted transition-colors hover:text-terracotta"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a place (optional)"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-paper/50 px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-lavender/60"
              />
              <AnimatePresence>
                {(results.length > 0 || searching || searchError) && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-hairline bg-surface shadow-lift"
                  >
                    {searching && (
                      <li className="px-3 py-2 text-sm text-muted">Searching…</li>
                    )}
                    {!searching && searchError && (
                      <li className="px-3 py-2 text-sm text-muted">
                        No places found — try a nearby town or city.
                      </li>
                    )}
                    {!searching &&
                      results.map((r) => (
                        <li key={`${r.name}-${r.latitude}-${r.longitude}`}>
                          <button
                            type="button"
                            onClick={() => pick(r)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-lavender/10"
                          >
                            <PinIcon />
                            {placeLabel(r)}
                          </button>
                        </li>
                      ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
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
      className="shrink-0 text-lavender"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
