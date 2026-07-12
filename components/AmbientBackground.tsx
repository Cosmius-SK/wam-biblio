"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BG_EVENT, readBgIntensity } from "@/lib/appearance";

/**
 * The fluid, living background behind every page: three soft colour fields
 * that drift very slowly and re-tint with the time of day. Visibility is the
 * user's choice — the Appearance slider scales it live from whisper to vivid.
 */
type Palette = { a: string; b: string; c: string };

// Base colours per time of day (rgb only — alpha comes from the intensity).
function paletteForHour(hour: number): Palette {
  if (hour < 5) return { a: "104,98,160", b: "70,76,118", c: "150,120,160" }; // deep night
  if (hour < 11) return { a: "238,178,132", b: "168,192,150", c: "196,168,206" }; // morning
  if (hour < 16) return { a: "232,192,140", b: "158,188,168", c: "184,166,212" }; // midday
  if (hour < 20) return { a: "222,138,96", b: "162,142,204", c: "146,176,142" }; // dusk
  return { a: "156,140,196", b: "96,102,148", c: "204,146,122" }; // evening
}

const rad = (rgb: string, alpha: number) =>
  `radial-gradient(circle at center, rgba(${rgb},${alpha.toFixed(3)}), transparent 70%)`;

export default function AmbientBackground() {
  const [palette, setPalette] = useState<Palette>(() => paletteForHour(new Date().getHours()));
  const [intensity, setIntensity] = useState(65);

  useEffect(() => {
    setIntensity(readBgIntensity());
    const tick = () => setPalette(paletteForHour(new Date().getHours()));
    tick();
    const id = setInterval(tick, 10 * 60 * 1000);
    const onChange = (e: Event) => setIntensity((e as CustomEvent<number>).detail);
    window.addEventListener(BG_EVENT, onChange);
    return () => {
      clearInterval(id);
      window.removeEventListener(BG_EVENT, onChange);
    };
  }, []);

  const k = intensity / 100;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-[15%] -top-[12%] h-[75vh] w-[75vh] rounded-full blur-3xl"
        style={{ background: rad(palette.a, 0.85 * k) }}
        animate={{ x: [0, 50, -25, 0], y: [0, 35, 70, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[18%] top-[28%] h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{ background: rad(palette.b, 0.75 * k) }}
        animate={{ x: [0, -45, 20, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[15%] left-[10%] h-[65vh] w-[65vh] rounded-full blur-3xl"
        style={{ background: rad(palette.c, 0.6 * k) }}
        animate={{ x: [0, 40, -35, 0], y: [0, -45, -15, 0] }}
        transition={{ duration: 44, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
