"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flushDraft } from "@/lib/drafts";
import { db } from "@/lib/db";
import { maya, type ReadingState } from "@/lib/maya";
import MayaOrb from "./MayaOrb";

/**
 * Updates, on the reader's terms.
 *
 * A service worker could activate a new build underneath someone mid-sentence.
 * It never does: it waits, this tells them, and they choose. The draft is
 * flushed before the reload either way, because an update that takes words
 * away is worse than an update that waits.
 *
 * Afterwards, one card saying what changed — read from CHANGELOG.md at build
 * time, so there is no second copy to drift. Maya will read it out if asked;
 * a list of changes is exactly the sort of thing people skip, and hearing it
 * costs nothing.
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

/** A speaker, drawn small: the offer to hear this rather than read it. */
function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8.4 2.6 5 5.4H2.8v5.2H5l3.4 2.8V2.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M11 5.6a3.4 3.4 0 0 1 0 4.8M12.9 3.5a6.2 6.2 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5.6 3.2v9.6M10.4 3.2v9.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Updates() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [whatsNew, setWhatsNew] = useState<string[] | null>(null);
  const [reading, setReading] = useState<ReadingState>({ index: null, active: false });
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
  // Nothing to offer if this browser has no speech, or she has been turned off
  // — an update card is not the place to talk someone out of that choice.
  const canRead = maya.canSpeak() && maya.voiceSetting() !== "";

  useEffect(() => maya.onReading(setReading), []);
  // Leaving the page ends the reading; she is claimed while she reads, and a
  // claim nobody ever releases is a Maya who never speaks again.
  useEffect(() => () => maya.stopReading(), []);

  /** The intro, then one line per change: the seams she can be stopped at. */
  function spokenLines(notes: string[]): string[] {
    return [`A few things changed in version ${version}.`, ...notes];
  }

  function toggleReading() {
    if (!whatsNew) return;
    if (reading.active) {
      maya.pauseReading();
      return;
    }
    // Straight out of the tap: iOS only starts speech inside a gesture.
    maya.prime();
    maya.readAloud(spokenLines(whatsNew));
  }

  useEffect(() => {
    // Nobody arriving for the first time wants to hear what changed — there is
    // no before for them. The stored version is only half the test, because it
    // belongs to the browser rather than the person: sign in as someone new in
    // a browser that has been used, and they inherit a note about a version
    // they never saw. An empty journal is the honest signal.
    void (async () => {
      try {
        const seen = localStorage.getItem(SEEN_KEY);
        const written = await db.entries.filter((e) => !e.id.startsWith("demo-")).count();
        if (!seen || written === 0) {
          localStorage.setItem(SEEN_KEY, version);
          return;
        }
        if (seen !== version && notes().length > 0) setWhatsNew(notes());
      } catch {
        /* private mode */
      }
    })();
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
    maya.stopReading(); // she doesn't carry on reading to an empty room
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
              className="w-full max-w-md overflow-hidden rounded-2xl border border-hairline/70 bg-surface shadow-soft"
            >
              {/* The tape across a door that has just been worked on. It says
                  what this card is before a word of it is read. */}
              <div className="renovation-tape flex items-baseline justify-between gap-3 border-b border-hairline/60 px-6 py-3">
                <span className="text-2xs uppercase tracking-[0.18em] text-ink/75">
                  Renovations
                </span>
                <span className="text-2xs uppercase tracking-[0.14em] text-ink/45">
                  Version {version}
                </span>
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-serif text-xl text-ink">A few things changed</h2>
                  {canRead && (
                    <div className="-mt-1 flex flex-none items-center gap-2">
                      {/* She is here while she reads, and tapping her stops
                          her — the same gesture as interrupting a person. */}
                      {reading.active && (
                        <button
                          type="button"
                          onClick={() => maya.pauseReading()}
                          aria-label="Stop reading"
                          className="rounded-full p-1.5 transition-colors hover:bg-lavender/10"
                        >
                          <MayaOrb size={20} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={toggleReading}
                        aria-label={
                          reading.active
                            ? "Pause"
                            : reading.index !== null
                              ? "Carry on reading"
                              : "Read this aloud"
                        }
                        aria-pressed={reading.active}
                        className={`rounded-full border p-2 transition-colors ${
                          reading.active || reading.index !== null
                            ? "border-lavender/60 bg-lavender/10 text-ink"
                            : "border-hairline bg-paper/50 text-muted hover:border-lavender/40 hover:text-ink"
                        }`}
                      >
                        {reading.active ? <PauseIcon /> : <SpeakerIcon />}
                      </button>
                    </div>
                  )}
                </div>

                <ul className="mt-4 max-h-[45vh] space-y-2.5 overflow-y-auto">
                  {whatsNew.map((n, i) => {
                    // The intro is line 0, so a change is one further along.
                    const here = reading.index === i + 1;
                    return (
                      <li
                        key={n}
                        className={`-mx-2 rounded-lg px-2 py-1 text-sm leading-relaxed transition-colors ${
                          here ? "bg-lavender/10 text-ink" : "text-muted"
                        }`}
                      >
                        <span className={`mr-2 ${here ? "text-lavender" : "text-lavender/70"}`}>
                          ·
                        </span>
                        {n}
                      </li>
                    );
                  })}
                </ul>

                {canRead && reading.index !== null && !reading.active && (
                  <p className="mt-3 text-2xs text-muted/70">
                    Paused. The speaker picks her up where she stopped.
                  </p>
                )}

                <button
                  type="button"
                  onClick={dismiss}
                  className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform active:scale-95"
                >
                  Carry on
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
