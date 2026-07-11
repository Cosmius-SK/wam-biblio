"use client";

import { getSetting, setSetting } from "./db";

/**
 * The illustration look is a per-device choice among three curated styles —
 * all in biblio's warm palette, so switching stays on-brand. The prompt text
 * for each lives server-side (lib route); here we keep only the keys + labels
 * for the picker.
 */
export interface StyleOption {
  key: string;
  label: string;
  blurb: string;
}

export const ILLUSTRATION_STYLES: StyleOption[] = [
  { key: "line", label: "Soft line", blurb: "Clean flat line-art, storybook calm." },
  { key: "watercolor", label: "Watercolor wash", blurb: "Loose ink with soft watercolor washes." },
  { key: "pencil", label: "Pencil & wash", blurb: "Soft graphite, quiet sketchbook feel." },
];

export const DEFAULT_STYLE = "line";

export async function getPreferredStyle(): Promise<string> {
  return (await getSetting("imageStyle")) || DEFAULT_STYLE;
}

export async function setPreferredStyle(key: string): Promise<void> {
  await setSetting("imageStyle", key);
}
