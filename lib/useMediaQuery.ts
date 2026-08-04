"use client";

import { useEffect, useState } from "react";

/**
 * Match a media query in React. Starts false so the server and the first
 * client render agree (mobile-first), then settles after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Laptop and up — where biblio gets room to spread out. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
