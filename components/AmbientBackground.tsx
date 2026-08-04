"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BG_EVENT, readBgIntensity } from "@/lib/appearance";

/**
 * The living background behind every page — and, from here on, Maya's mood:
 * three soft colour fields that drift, swell and cross the screen, re-tinting
 * with the time of day.
 *
 * Motion is expressed as a PERCENTAGE of each field's own size, so the travel
 * scales with the screen and is genuinely visible (an earlier version moved
 * ~40px behind a 64px blur — animating on paper, frozen to the eye). The
 * Appearance slider drives both how visible the colour is and how briskly it
 * moves, and prefers-reduced-motion stills it completely.
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

const field = (rgb: string, alpha: number) =>
  `radial-gradient(circle at center, rgba(${rgb},${alpha.toFixed(3)}) 0%, rgba(${rgb},${(
    alpha * 0.45
  ).toFixed(3)}) 38%, rgba(${rgb},0) 70%)`;

export default function AmbientBackground() {
  const [palette, setPalette] = useState<Palette>(() => paletteForHour(new Date().getHours()));
  const [intensity, setIntensity] = useState(65);
  const still = useReducedMotion();

  useEffect(() => {
    setIntensity(readBgIntensity());
    const tick = () => setPalette(paletteForHour(new Date().getHours()));
    tick();
    const id = setInterval(tick, 10 * 60 * 1000); // re-tint every 10 minutes
    const onChange = (e: Event) => setIntensity((e as CustomEvent<number>).detail);
    window.addEventListener(BG_EVENT, onChange);
    return () => {
      clearInterval(id);
      window.removeEventListener(BG_EVENT, onChange);
    };
  }, []);

  const k = intensity / 100;
  // Brisker at full strength, unhurried when dialled down.
  const pace = 1.5 - 0.7 * k;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Field
        rgb={palette.a}
        alpha={0.95 * k}
        className="-left-[15%] -top-[20%] h-[85vh] w-[85vh]"
        x={["0%", "26%", "-8%", "0%"]}
        y={["0%", "18%", "38%", "0%"]}
        scale={[1, 1.14, 0.94, 1]}
        duration={24 * pace}
        still={still}
      />
      <Field
        rgb={palette.b}
        alpha={0.8 * k}
        className="-right-[20%] top-[22%] h-[78vh] w-[78vh]"
        x={["0%", "-24%", "10%", "0%"]}
        y={["0%", "-20%", "22%", "0%"]}
        scale={[1, 0.92, 1.12, 1]}
        duration={31 * pace}
        still={still}
      />
      <Field
        rgb={palette.c}
        alpha={0.66 * k}
        className="-bottom-[22%] left-[8%] h-[72vh] w-[72vh]"
        x={["0%", "20%", "-18%", "0%"]}
        y={["0%", "-26%", "-8%", "0%"]}
        scale={[1, 1.1, 0.96, 1]}
        duration={38 * pace}
        still={still}
      />
    </div>
  );
}

/** One drifting colour field. Percent-based travel keeps it visible on any screen. */
function Field({
  rgb,
  alpha,
  className,
  x,
  y,
  scale,
  duration,
  still,
}: {
  rgb: string;
  alpha: number;
  className: string;
  x: string[];
  y: string[];
  scale: number[];
  duration: number;
  still: boolean | null;
}) {
  return (
    <motion.div
      className={`absolute rounded-full blur-2xl ${className}`}
      style={{ background: field(rgb, alpha), willChange: "transform" }}
      animate={still ? undefined : { x, y, scale }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", times: [0, 0.34, 0.68, 1] }}
    />
  );
}
