"use client";

import { useEffect, useRef } from "react";
import { onDataChange } from "@/lib/db";
import { onSessionStart } from "@/lib/session";
import { autoPull, autoPush, isGoogleConnected } from "@/lib/googleAccount";
import { isDriveConnected, refreshTokenIfStale } from "@/lib/drive";

/**
 * Invisible driver for Google-account sync: pull when someone arrives, then
 * push (debounced) after any local change.
 *
 * "Arrives" used to mean only a fresh page load, which meant a laptop left open
 * on another tab never learned that anything had changed — a draft written on a
 * phone would sit there unseen until the whole page was reloaded. It now also
 * pulls when a visit begins and when a tab is come back to after a while.
 *
 * It also keeps the Drive token alive. Google's browser token flow expires
 * after about an hour and cannot be renewed without a tap, so left alone it
 * fails on whatever the next tap happens to be — reliably, the moment someone
 * attaches a photo. Renewing it early and silently, at a quiet moment, is the
 * difference between that and never noticing.
 *
 * Silent by design — the account card in Settings shows status and surfaces
 * errors; a transient sync hiccup here should never interrupt writing.
 */
/** Long enough away that something may have happened elsewhere. */
const AWAY_MS = 45_000;
/** The token has an hour on it; looking every few minutes is plenty. */
const TOKEN_CHECK_MS = 4 * 60_000;
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

    // Self-gating on both counts: it does nothing without Drive connected, and
    // nothing while the token in hand still has a comfortable margin.
    const keepToken = () => {
      void isDriveConnected().then((on) => {
        if (on) void refreshTokenIfStale();
      });
    };
    keepToken();
    const tokenTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") keepToken();
    }, TOKEN_CHECK_MS);

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // Coming back from an hour in a pocket is exactly when the token has
      // died, and exactly when the next tap is about to need it.
      keepToken();
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
      window.clearInterval(tokenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return null;
}
