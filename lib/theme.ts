"use client";

/**
 * Light / dusk / auto, per device.
 *
 * The RESOLVED theme is always stamped on <html data-theme>, even for "auto"
 * (where it follows the device and updates live). Nothing is left to the
 * media query at runtime, so a chosen paper can never be overridden by the
 * OS setting — the media query in globals.css is only a no-JS fallback.
 *
 * Applied before first paint by the inline script in app/layout.tsx, and kept
 * in sync by components/ThemeSync.tsx.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "biblio_theme";

/** The reader's preference (what the Appearance card shows). */
export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* SSR / private mode */
  }
  return "system";
}

/** What "auto" currently means on this device. */
export function systemTheme(): "light" | "dark" {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? systemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the choice just won't persist */
  }
  applyTheme(theme);
}
