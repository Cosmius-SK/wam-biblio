"use client";

import { useEffect, useRef } from "react";
import { onDataChange } from "@/lib/db";
import { onSessionStart } from "@/lib/session";
import { autoPull, autoPush, isGoogleConnected } from "@/lib/googleAccount";

/**
 * Invisible driver for Google-account sync: pull when someone arrives, then
 * push (debounced) after any local change.
 *
 * "Arrives" used to mean only a fresh page load, which meant a laptop left open
 * on another tab never learned that anything had changed — a draft written on a
 * phone would sit there unseen until the whole page was reloaded. It now also
 * pulls when a visit begins and when a tab is come back to after a while.
 *
 * Silent by design — the account card in Settings shows status and surfaces
 * errors; a transient sync hiccup here should never interrupt writing.
 */
/** Long enough away that something may have happened elsewhere. */
const AWAY_MS = 45_000;
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

    const pull = () => {
      void autoPull().catch(() => {
        /* surfaced in the account card */
      });
    };
    const stopSession = onSessionStart(pull);

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) pull();
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);

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
      stopSession();
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return null;
}
