"use client";

import { useEffect, useState } from "react";
import { ILLUSTRATION_STYLES, getPreferredStyle, setPreferredStyle, DEFAULT_STYLE } from "@/lib/styles";

/**
 * Pick one of three curated illustration looks. Applies instantly to new
 * illustrations (existing ones keep their look until regenerated). The three
 * options all live in biblio's palette, so the timeline stays coherent.
 */
export default function StylePicker() {
  const [selected, setSelected] = useState<string>(DEFAULT_STYLE);

  useEffect(() => {
    void getPreferredStyle().then(setSelected);
  }, []);

  async function choose(key: string) {
    setSelected(key);
    await setPreferredStyle(key);
  }

  return (
    <div className="space-y-2">
      {ILLUSTRATION_STYLES.map((s) => {
        const active = selected === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => choose(s.key)}
            aria-pressed={active}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              active ? "border-lavender/60 bg-lavender/10" : "border-hairline bg-paper/40 hover:border-lavender/30"
            }`}
          >
            <StyleGlyph kind={s.key} active={active} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${active ? "text-ink" : "text-ink/80"}`}>{s.label}</p>
              <p className="text-xs text-muted">{s.blurb}</p>
            </div>
            <span
              className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                active ? "border-lavender bg-lavender" : "border-hairline"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** A tiny motif hinting at each look, tinted by selection. */
function StyleGlyph({ kind, active }: { kind: string; active: boolean }) {
  const tint = active ? "text-lavender" : "text-muted";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline/60 bg-surface/60 ${tint}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
        {kind === "line" && (
          <path d="M4 15c3-5 5-5 8 0s5 5 8 0" strokeWidth="2" strokeLinecap="round" />
        )}
        {kind === "watercolor" && (
          <path
            d="M12 4c3 3 5 5 5 8a5 5 0 0 1-10 0c0-3 2-5 5-8Z"
            strokeWidth="1.6"
            fill="currentColor"
            fillOpacity="0.18"
          />
        )}
        {kind === "pencil" && (
          <path
            d="M5 19l1-4L16 5l3 3L9 18l-4 1Z"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.12"
          />
        )}
      </svg>
    </span>
  );
}
