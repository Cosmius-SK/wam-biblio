"use client";

import { useEffect } from "react";
import { applyTheme, readTheme } from "@/lib/theme";

/**
 * Keeps the stamped theme honest: re-applies the saved preference on mount
 * (a belt to the inline script's braces) and, while the preference is "auto",
 * follows the device if it flips light/dark under us.
 */
export default function ThemeSync() {
  useEffect(() => {
    applyTheme(readTheme());
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onSystemChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  return null;
}
