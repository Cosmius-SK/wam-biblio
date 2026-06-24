/**
 * Deterministic "scene" generator — a soft, painterly gradient image derived
 * purely from an entry's mood + a seed string. No API, no cost: this is the
 * sample-mode stand-in for AI scene images, and a graceful fallback whenever a
 * real generated image isn't present. Pure (no DOM), so it runs on client or
 * server.
 */

type Palette = [string, string, string];

const MOOD_PALETTES: Record<string, Palette> = {
  restless: ["#caa86a", "#6b7280", "#3f4654"],
  tender: ["#e6a8a0", "#e9c79b", "#b48aa6"],
  frayed: ["#8a93a3", "#b08a7a", "#5b5560"],
  quiet: ["#8e82b0", "#5b6478", "#2f3340"],
  hopeful: ["#f0c9a0", "#bcd0a8", "#e9d6b0"],
  grateful: ["#e0b48a", "#d99f86", "#c98f6a"],
  reflective: ["#e3b486", "#caa06a", "#8a6f53"],
  joyful: ["#f2c87a", "#e89c6a", "#d98aa0"],
  calm: ["#a8c0b8", "#cdd9c6", "#8fae9e"],
  peaceful: ["#a8c0b8", "#cdd9c6", "#8fae9e"],
  sad: ["#7a8aa0", "#5b6478", "#9aa0ae"],
  lonely: ["#7a8aa0", "#6b6478", "#9aa0ae"],
  anxious: ["#9a8a86", "#b08a7a", "#5b5560"],
};

const FALLBACK_PALETTES: Palette[] = [
  ["#c0a890", "#d8c8b0", "#9aa890"],
  ["#bcae9e", "#cdb89e", "#8fa0a0"],
  ["#d2b48c", "#c9a8b0", "#8a90a8"],
];

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paletteFor(mood: string): Palette {
  const key = mood.toLowerCase().trim();
  if (MOOD_PALETTES[key]) return MOOD_PALETTES[key];
  return FALLBACK_PALETTES[hash(key) % FALLBACK_PALETTES.length];
}

/** Build an SVG "scene" string for the given seed + mood. */
export function sceneSvg(seed: string, mood: string): string {
  const rng = mulberry32(hash(`${mood}:${seed}`));
  const [c0, c1, c2] = paletteFor(mood);
  const w = 800;
  const h = 500;

  const blob = (cx: number, cy: number, r: number, fill: string, op: number) =>
    `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${fill}" opacity="${op.toFixed(2)}"/>`;

  const blobs = [
    blob(rng() * w, rng() * h * 0.7, 150 + rng() * 140, c1, 0.55),
    blob(rng() * w, rng() * h, 130 + rng() * 130, c2, 0.5),
    blob(rng() * w, rng() * h * 0.8, 110 + rng() * 120, c0, 0.45),
  ].join("");

  // A soft low "sun/moon" orb gives the abstract field a sense of horizon.
  const orbX = (0.2 + rng() * 0.6) * w;
  const orbY = (0.18 + rng() * 0.22) * h;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="${(0.3 + rng() * 0.7).toFixed(2)}" y2="1">
<stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c2}"/>
</linearGradient>
<radialGradient id="orb" cx="50%" cy="50%" r="50%">
<stop offset="0" stop-color="#fff4e6" stop-opacity="0.9"/>
<stop offset="1" stop-color="#fff4e6" stop-opacity="0"/>
</radialGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="55"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<g filter="url(#soft)">${blobs}</g>
<circle cx="${orbX.toFixed(0)}" cy="${orbY.toFixed(0)}" r="${(70 + rng() * 50).toFixed(0)}" fill="url(#orb)"/>
</svg>`;

  return svg;
}

/** A ready-to-use data URL for <img src> or CSS background. */
export function sceneDataUrl(seed: string, mood: string): string {
  return `data:image/svg+xml,${encodeURIComponent(sceneSvg(seed, mood))}`;
}
