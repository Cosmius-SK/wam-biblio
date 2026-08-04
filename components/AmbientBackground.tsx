"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BG_EVENT, readBgIntensity } from "@/lib/appearance";

/**
 * The living background — and, from here on, Maya's mood.
 *
 * Nothing here is fixed: the number of colour fields, where they sit, which
 * hue each takes, how far it wanders and how long it takes are all rolled
 * fresh on load, so no corner of the screen belongs to one colour and the
 * composition is never the same twice. Each field's outline morphs while it
 * rotates, drifts and swells; the layers blend into one another (watercolour
 * bleed on day paper, aurora light on dusk) so they read as one moving body
 * of colour rather than as blobs.
 *
 * Shapes and motion live in CSS (.fluid-field in globals.css) — GPU-composited
 * and free of React re-renders. This component only rolls the dice and hands
 * down the hour's palette and the Appearance slider.
 */
type Palette = string[];

function paletteForHour(hour: number): Palette {
  if (hour < 5) return ["104,98,160", "70,76,118", "150,120,160", "60,70,110", "126,110,170"];
  if (hour < 11) return ["238,178,132", "168,192,150", "196,168,206", "232,206,160", "210,190,170"];
  if (hour < 16) return ["232,192,140", "158,188,168", "184,166,212", "220,200,170", "196,206,186"];
  if (hour < 20) return ["222,138,96", "162,142,204", "146,176,142", "226,170,130", "188,150,180"];
  return ["156,140,196", "96,102,148", "204,146,122", "120,116,168", "140,128,180"];
}

interface FieldSpec {
  left: number; // %
  top: number; // %
  size: number; // vh
  hue: number; // index into the palette
  alpha: number;
  drift: number; // seconds
  morph: number; // seconds
  delayDrift: number;
  delayMorph: number;
  path: { x: number; y: number }[]; // three waypoints, in % of the field's size
  scales: number[];
  gradientAt: string;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Roll a fresh composition: 5–7 fields scattered across the whole screen. */
function rollFields(hueCount: number): FieldSpec[] {
  const count = 5 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, () => ({
    // Spread across (and beyond) the viewport, middle included.
    left: rand(-25, 80),
    top: rand(-25, 80),
    size: rand(48, 92),
    hue: Math.floor(Math.random() * hueCount),
    alpha: rand(0.5, 1),
    drift: rand(30, 68),
    morph: rand(14, 34),
    delayDrift: -rand(0, 60),
    delayMorph: -rand(0, 30),
    // Far enough to cross the middle rather than hovering in one corner.
    path: Array.from({ length: 3 }, () => ({ x: rand(-55, 55), y: rand(-45, 45) })),
    scales: [rand(0.9, 1.25), rand(0.85, 1.2), rand(0.9, 1.3)],
    gradientAt: `${Math.round(rand(28, 72))}% ${Math.round(rand(28, 72))}%`,
  }));
}

export default function AmbientBackground() {
  const [palette, setPalette] = useState<Palette>(() => paletteForHour(new Date().getHours()));
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [intensity, setIntensity] = useState(65);

  useEffect(() => {
    setIntensity(readBgIntensity());
    // Rolled after mount so the server and client never disagree on the dice.
    setFields(rollFields(paletteForHour(new Date().getHours()).length));
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
      {fields.map((f, i) => {
        const rgb = palette[f.hue % palette.length];
        const a = f.alpha * k;
        const style = {
          left: `${f.left}%`,
          top: `${f.top}%`,
          height: `${f.size}vh`,
          width: `${f.size}vh`,
          background: `radial-gradient(circle at ${f.gradientAt}, rgba(${rgb},${a.toFixed(
            3,
          )}) 0%, rgba(${rgb},${(a * 0.5).toFixed(3)}) 40%, rgba(${rgb},0) 72%)`,
          animationDuration: `${(f.drift * pace).toFixed(1)}s, ${(f.morph * pace).toFixed(1)}s, 2s`,
          animationDelay: `${f.delayDrift.toFixed(1)}s, ${f.delayMorph.toFixed(1)}s, 0s`,
          "--x1": `${f.path[0].x.toFixed(1)}%`,
          "--y1": `${f.path[0].y.toFixed(1)}%`,
          "--x2": `${f.path[1].x.toFixed(1)}%`,
          "--y2": `${f.path[1].y.toFixed(1)}%`,
          "--x3": `${f.path[2].x.toFixed(1)}%`,
          "--y3": `${f.path[2].y.toFixed(1)}%`,
          "--s1": f.scales[0].toFixed(2),
          "--s2": f.scales[1].toFixed(2),
          "--s3": f.scales[2].toFixed(2),
        } as CSSProperties;
        return <div key={i} className="fluid-field" style={style} />;
      })}
    </div>
  );
}
