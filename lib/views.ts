"use client";

/** Per-tab view choice — scroll (the living timeline) or book (flip-through).
 * Stored per device, one key per tab, like the other appearance choices. */
export type ViewMode = "scroll" | "book";
export type ViewTab = "timeline" | "gallery";

export function readView(tab: ViewTab): ViewMode {
  try {
    return localStorage.getItem(`biblio_view_${tab}`) === "book" ? "book" : "scroll";
  } catch {
    return "scroll";
  }
}

export function saveView(tab: ViewTab, v: ViewMode): void {
  try {
    localStorage.setItem(`biblio_view_${tab}`, v);
  } catch {
    /* private mode */
  }
}
