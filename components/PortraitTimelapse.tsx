"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Portrait } from "@/lib/types";

/** The MM‑YY stamp shown over each frame, e.g. "07‑26". */
function stampMMYY(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}‑${yy}`;
}

const FRAME_MS = 1500;

/**
 * A fluid timelapse through every self-portrait, oldest → newest. Each frame
 * crossfades into the next and carries its own MM‑YY stamp. Auto-advances,
 * loops, and closes on a tap anywhere (or Esc). Portraits arrive already
 * ordered oldest-first.
 */
export default function PortraitTimelapse({
  portraits,
  onClose,
}: {
  portraits: Portrait[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (portraits.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % portraits.length), FRAME_MS);
    return () => clearInterval(id);
  }, [portraits.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = portraits[i] ?? portraits[0];
  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Portrait timelapse — tap to close"
    >
      <span
        aria-hidden
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
      >
        ✕
      </span>

      <div className="relative flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl shadow-lift">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={current.id}
            src={current.thumb}
            alt=""
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-serif text-3xl tracking-wide text-white/95 tabular-nums drop-shadow">
          {stampMMYY(current.capturedAt)}
        </span>
      </div>

      {/* Frame ticks so the passage of time is legible. */}
      <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-1.5">
        {portraits.map((p, n) => (
          <span
            key={p.id}
            className={`h-1.5 rounded-full transition-all ${
              n === i ? "w-6 bg-white" : "w-1.5 bg-white/35"
            }`}
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-white/60">Tap anywhere to close</p>
    </motion.div>
  );
}
