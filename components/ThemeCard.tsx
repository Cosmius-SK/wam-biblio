"use client";

import { useEffect, useState } from "react";
import { readTheme, setTheme, type Theme } from "@/lib/theme";

const CHOICES: { key: Theme; label: string; hint: string }[] = [
  { key: "light", label: "Day", hint: "Warm paper" },
  { key: "dark", label: "Dusk", hint: "Warm dark" },
  { key: "system", label: "Auto", hint: "Follow device" },
];

/** Appearance › Paper: light, dark, or whatever the device is doing. */
export default function ThemeCard() {
  const [theme, setLocal] = useState<Theme>("system");

  useEffect(() => setLocal(readTheme()), []);

  function choose(next: Theme) {
    setLocal(next);
    setTheme(next); // applies immediately — the whole page re-tints
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Paper</h2>
      <p className="mt-1 text-sm text-muted">
        Light paper or dusk — or let it follow your device.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {CHOICES.map((c) => {
          const active = theme === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => choose(c.key)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                active
                  ? "border-lavender/60 bg-lavender/10"
                  : "border-hairline bg-paper/40 hover:border-lavender/30"
              }`}
            >
              <span className={`block text-sm font-medium ${active ? "text-ink" : "text-ink/80"}`}>
                {c.label}
              </span>
              <span className="mt-0.5 block text-2xs text-muted">{c.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
