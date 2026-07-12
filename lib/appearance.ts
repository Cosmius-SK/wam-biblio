"use client";

/** Background intensity (0–100): how visible the drifting colours are.
 * Per-device, like the music volume; changes apply live via a window event. */
const KEY = "biblio_bg";
export const BG_EVENT = "biblio-bg-change";
export const BG_DEFAULT = 65;

export function readBgIntensity(): number {
  try {
    const n = parseInt(localStorage.getItem(KEY) ?? "", 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  } catch {
    /* SSR / private mode */
  }
  return BG_DEFAULT;
}

export function setBgIntensity(v: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(v)));
  try {
    localStorage.setItem(KEY, String(clamped));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent<number>(BG_EVENT, { detail: clamped }));
}
