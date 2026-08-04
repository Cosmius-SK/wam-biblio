"use client";

/**
 * Light / dark / system, per device. "system" leaves the choice to the OS
 * (the media query in globals.css); the other two stamp data-theme on <html>,
 * which the CSS honours over the media query.
 *
 * Applied as early as possible — see the inline script in app/layout.tsx —
 * so a chosen theme never flashes the wrong paper on load.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "biblio_theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* SSR / private mode */
  }
  return "system";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
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
