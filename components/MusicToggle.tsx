"use client";

import { useEffect, useState } from "react";
import { ambient } from "@/lib/ambient";

/**
 * A small header control for the generated ambient pad. Playing state
 * "breathes"; the pad auto-ducks while the mic is open (see VoiceRecorder)
 * and softens when the tab is hidden.
 */
export default function MusicToggle() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(ambient.isPlaying());
    const unsubscribe = ambient.subscribe(setPlaying);
    const onVisibility = () => {
      if (document.hidden) ambient.duck();
      else ambient.unduck();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => ambient.toggle()}
      aria-pressed={playing}
      aria-label={playing ? "Pause ambient music" : "Play ambient music"}
      title={playing ? "Ambient on — tap to pause" : "Soft ambient music"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
        playing
          ? "animate-breathe border-lavender/40 bg-lavender/15 text-lavender"
          : "border-hairline/70 bg-surface/60 text-muted hover:text-ink"
      }`}
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
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </button>
  );
}
