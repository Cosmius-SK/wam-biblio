"use client";

import { useEffect, useState } from "react";
import { readBgIntensity, setBgIntensity } from "@/lib/appearance";

/** Appearance › Background mood: how visible the drifting colours are. */
export default function BackgroundCard() {
  const [value, setValue] = useState(65);

  useEffect(() => {
    setValue(readBgIntensity());
  }, []);

  function change(v: number) {
    setValue(v);
    setBgIntensity(v); // applies live — the background is right behind this card
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Background mood</h2>
      <p className="mt-1 text-sm text-muted">
        How visible the drifting colours are, on every page. It re-tints with the time of day.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => change(Number(e.target.value))}
          aria-label="Background intensity"
          className="h-2 flex-1 cursor-pointer accent-lavender"
        />
        <span className="w-10 text-right text-sm tabular-nums text-muted">{value}%</span>
      </div>
    </div>
  );
}
