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
 * A small header switch between free sample previews and live AI. The choice
 * is a per-device cookie the API routes read — so flipping it is instant and
 * needs no redeploy. Going live asks for confirmation, since it spends credit.
 */
export default function ModeToggle() {
  const [mode, setMode] = useState<Mode>("sample");

  useEffect(() => setMode(readMode()), []);

  function persist(next: Mode) {
    document.cookie = `${AI_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
  }

  function toggle() {
    if (mode === "sample") {
      const ok = window.confirm(
        "Turn on live AI?\n\nShaping, Ask and Reflect will use your Anthropic credit on each action (typically a few cents). Switch back anytime — your entries stay the same.",
      );
      if (!ok) return;
      persist("live");
    } else {
      persist("sample");
    }
  }

  const live = mode === "live";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={live}
      title={live ? "Live AI — uses your credit. Tap for free sample mode." : "Sample mode — free. Tap to use live AI."}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        live
          ? "border-terracotta/40 bg-terracotta/15 text-terracotta"
          : "border-hairline/70 bg-surface/60 text-muted hover:text-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-terracotta" : "bg-sage"}`} />
      {live ? "Live AI" : "Sample · free"}
    </button>
  );
}
