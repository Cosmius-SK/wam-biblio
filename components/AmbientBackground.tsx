"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * A soft, full-screen gradient that shifts with the time of day — the quiet
 * "alive" heartbeat of the journal. Fixed behind all content, it re-tints
 * gently as morning turns to dusk to night.
 */
type Palette = { a: string; b: string; c: string };

function paletteForHour(hour: number): Palette {
  if (hour < 5) {
    // deep night — muted indigo/charcoal
    return { a: "rgba(60,58,92,0.30)", b: "rgba(40,42,60,0.22)", c: "rgba(30,28,34,0.0)" };
  }
  if (hour < 11) {
    // morning — soft peach + pale sage
    return { a: "rgba(242,215,194,0.55)", b: "rgba(206,214,190,0.40)", c: "rgba(247,243,235,0.0)" };
  }
  if (hour < 16) {
    // midday — light, airy warmth
    return { a: "rgba(244,236,222,0.55)", b: "rgba(214,222,214,0.38)", c: "rgba(247,243,235,0.0)" };
  }
  if (hour < 20) {
    // dusk — terracotta + lavender
    return { a: "rgba(214,150,120,0.45)", b: "rgba(176,160,200,0.40)", c: "rgba(247,243,235,0.0)" };
  }
  // evening — lavender into deepening blue
  return { a: "rgba(150,138,184,0.40)", b: "rgba(96,98,132,0.30)", c: "rgba(30,28,34,0.0)" };
}

export default function AmbientBackground() {
  const [palette, setPalette] = useState<Palette>(() => paletteForHour(new Date().getHours()));

  useEffect(() => {
    const tick = () => setPalette(paletteForHour(new Date().getHours()));
    tick();
    const id = setInterval(tick, 10 * 60 * 1000); // re-tint every 10 minutes
    return () => clearInterval(id);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl animate-breathe"
        style={{ background: `radial-gradient(circle at center, ${palette.a}, transparent 70%)` }}
        animate={{ background: `radial-gradient(circle at center, ${palette.a}, transparent 70%)` }}
        transition={{ duration: 3 }}
      />
      <motion.div
        className="absolute top-1/4 -right-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle at center, ${palette.b}, transparent 70%)` }}
        transition={{ duration: 3 }}
      />
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${palette.c}, rgb(var(--paper)) 75%)` }}
      />
    </div>
  );
}
