"use client";

import { useEffect, useState } from "react";
import { AI_MODE_COOKIE } from "@/lib/ai/constants";

type Mode = "sample" | "live";

function readMode(): Mode {
  if (typeof document === "undefined") return "sample";
  const m = document.cookie.match(new RegExp(`(?:^|; )${AI_MODE_COOKIE}=([^;]*)`));
  return m && decodeURIComponent(m[1]) === "live" ? "live" : "sample";
}

/**
 * Settings › AI mode: the per-device switch between free sample previews and
 * live AI (spends credit). Same cookie the API routes read — flipping it is
 * instant, no redeploy.
 */
export default function AiModeCard() {
  const [mode, setMode] = useState<Mode>("sample");

  useEffect(() => setMode(readMode()), []);

  function persist(next: Mode) {
    document.cookie = `${AI_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
  }

  function toggle() {
    if (mode === "sample") {
      const ok = window.confirm(
        "Turn on live AI?\n\nShaping, Ask, Reflect and Illustrate will use your credit on each action (typically a few cents). Switch back anytime — your entries stay the same.",
      );
      if (!ok) return;
      persist("live");
    } else {
      persist("sample");
    }
  }

  const live = mode === "live";
  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">AI mode</h2>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={live}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            live
              ? "border-terracotta/40 bg-terracotta/15 text-terracotta"
              : "border-hairline text-muted hover:text-ink"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-terracotta" : "bg-sage"}`} />
          {live ? "Live AI" : "Sample · free"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {live
          ? "Live — shaping, Ask, Reflect and illustrations use your credit on each action."
          : "Sample — every AI feature shows a free local preview; nothing is spent."}
      </p>
    </div>
  );
}
