"use client";

import { useEffect, useState } from "react";
import { ambient } from "@/lib/ambient";

/** Ambient music: play/pause and the volume of the generated pad. */
export default function AmbientCard() {
  const [vol, setVol] = useState(70);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setVol(Math.round(ambient.getVolume() * 100));
    setPlaying(ambient.isPlaying());
    return ambient.subscribe(setPlaying);
  }, []);

  function change(v: number) {
    setVol(v);
    ambient.setVolume(v / 100);
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">Ambient sound</h2>
        <button
          type="button"
          onClick={() => ambient.toggle()}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            playing
              ? "bg-lavender/15 text-lavender"
              : "border border-hairline text-muted hover:text-ink"
          }`}
        >
          {playing ? "Playing" : "Play"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Volume of the generated ambient pad.</p>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => change(Number(e.target.value))}
          aria-label="Ambient volume"
          className="h-2 flex-1 cursor-pointer accent-lavender"
        />
        <span className="w-10 text-right text-sm tabular-nums text-muted">{vol}%</span>
      </div>
    </div>
  );
}
