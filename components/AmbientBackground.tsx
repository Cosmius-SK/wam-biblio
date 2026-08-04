"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BG_EVENT, readBgIntensity } from "@/lib/appearance";

/**
 * The living background — and, from here on, Maya's mood.
 *
 * Four irregular fields of colour whose outlines morph while they rotate,
 * drift and swell, blending into one another (watercolour on day paper,
 * aurora on dusk) so they read as one flowing body rather than as blobs.
 * The shapes and motion live in CSS (see .fluid-field in globals.css); this
 * component only chooses the colours for the hour and hands the Appearance
 * slider down as custom properties.
 */
type Palette = [string, string, string, string];

function paletteForHour(hour: number): Palette {
  if (hour < 5) return ["104,98,160", "70,76,118", "150,120,160", "60,70,110"]; // deep night
  if (hour < 11) return ["238,178,132", "168,192,150", "196,168,206", "232,206,160"]; // morning
  if (hour < 16) return ["232,192,140", "158,188,168", "184,166,212", "220,200,170"]; // midday
  if (hour < 20) return ["222,138,96", "162,142,204", "146,176,142", "226,170,130"]; // dusk
  return ["156,140,196", "96,102,148", "204,146,122", "120,116,168"]; // evening
}

/** Where each field sits, how big it is, and the rhythm of its two cycles. */
const FIELDS = [
  { cls: "-left-[22%] -top-[26%] h-[92vh] w-[92vh]", drift: 34, morph: 17, alpha: 0.95, at: "36% 32%" },
  { cls: "-right-[26%] top-[6%] h-[86vh] w-[86vh]", drift: 43, morph: 21, alpha: 0.85, at: "62% 40%" },
  { cls: "-bottom-[30%] left-[2%] h-[88vh] w-[88vh]", drift: 51, morph: 26, alpha: 0.75, at: "40% 62%" },
  { cls: "-bottom-[18%] -right-[18%] h-[74vh] w-[74vh]", drift: 61, morph: 31, alpha: 0.6, at: "55% 55%" },
] as const;

export default function AmbientBackground() {
  const [palette, setPalette] = useState<Palette>(() => paletteForHour(new Date().getHours()));
  const [intensity, setIntensity] = useState(65);

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
      {FIELDS.map((f, i) => {
        const rgb = palette[i];
        const a = f.alpha * k;
        const style: CSSProperties = {
          background: `radial-gradient(circle at ${f.at}, rgba(${rgb},${a.toFixed(3)}) 0%, rgba(${rgb},${(
            a * 0.5
          ).toFixed(3)}) 40%, rgba(${rgb},0) 72%)`,
          animationDuration: `${(f.drift * pace).toFixed(1)}s, ${(f.morph * pace).toFixed(1)}s`,
          animationDelay: `${i * -7}s, ${i * -4}s`,
        };
        return <div key={i} className={`fluid-field ${f.cls}`} style={style} />;
      })}
    </div>
  );
}
