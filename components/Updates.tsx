"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flushDraft } from "@/lib/drafts";

/**
 * Updates, on the reader's terms.
 *
 * A service worker could activate a new build underneath someone mid-sentence.
 * It never does: it waits, this tells them, and they choose. The draft is
 * flushed before the reload either way, because an update that takes words
 * away is worse than an update that waits.
 *
 * Afterwards, one card saying what changed — read from CHANGELOG.md at build
 * time, so there is no second copy to drift.
 */
const SEEN_KEY = "biblio_seen_version";

function notes(): string[] {
  try {
    const parsed = JSON.parse(process.env.NEXT_PUBLIC_RELEASE_NOTES || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export default function Updates() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [whatsNew, setWhatsNew] = useState<string[] | null>(null);
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

  useEffect(() => {
    // A first-ever visit has no "what's new" — there is no before.
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (!seen) localStorage.setItem(SEEN_KEY, version);
      else if (seen !== version && notes().length > 0) setWhatsNew(notes());
    } catch {
      /* private mode */
    }
  }, [version]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with a controller already present means: a new build
            // is ready and the old one is still what you're reading.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        /* unsupported or blocked — the app simply won't work offline */
      });

    let reloading = false;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    };
  }, []);

  async function refreshNow() {
    await flushDraft(true);
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch {
      /* ignore */
    }
    waiting?.postMessage("skip-waiting");
  }

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch {
      /* ignore */
    }
    setWhatsNew(null);
  }

  return (
    <>
      <AnimatePresence>
        {waiting && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-5"
          >
            <div className="flex items-center gap-3 rounded-full border border-hairline bg-surface/95 px-4 py-2 shadow-soft backdrop-blur-md">
              <span className="text-sm text-muted">A newer biblio is ready.</span>
              <button
                type="button"
                onClick={() => void refreshNow()}
                className="rounded-full bg-ink/90 px-3 py-1.5 text-xs font-medium text-paper"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setWaiting(null)}
                aria-label="Later"
                className="text-xs text-muted/70 hover:text-ink"
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {whatsNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-5 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-full max-w-md rounded-2xl border border-hairline/70 bg-surface p-6 shadow-soft"
            >
              <h2 className="font-serif text-xl text-ink">A few things changed</h2>
              <p className="mt-1 text-xs text-muted">Version {version}</p>
              <ul className="mt-4 space-y-2.5">
                {whatsNew.map((n) => (
                  <li key={n} className="text-sm leading-relaxed text-muted">
                    <span className="mr-2 text-lavender">·</span>
                    {n}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={dismiss}
                className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform active:scale-95"
              >
                Carry on
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
