"use client";

import { useEffect, useRef } from "react";
import { onDataChange } from "@/lib/db";
import { autoPull, autoPush, isGoogleConnected } from "@/lib/googleAccount";

/**
 * Invisible driver for Google-account sync: pull once on app open, then push
 * (debounced) after any local change. Silent by design — the account card in
 * Settings shows status and surfaces errors; a transient sync hiccup here
 * should never interrupt writing.
 */
export default function AutoSync() {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled || !(await isGoogleConnected())) return;
      try {
        await autoPull();
      } catch {
        /* surfaced in the account card */
      }
    })();

    // autoPush() self-gates on the connection, so this also covers
    // connecting mid-session without a stale "connected" flag.
    const unsubscribe = onDataChange(() => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void autoPush().catch(() => {
          /* surfaced in the account card */
        });
      }, 4000);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return null;
}
