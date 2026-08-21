"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { STEPS } from "./steps";
import { finishTour, saveTourProgress, shouldRunTour, tourProgress } from "@/lib/tour";
import { getSetting } from "@/lib/db";
import { maya } from "@/lib/maya";
import MayaOrb from "@/components/MayaOrb";

/**
 * The walkthrough.
 *
 * Skippable at any point, resumable exactly where it was left, and repeatable
 * from Settings — because the only thing worse than no guidance is guidance
 * that traps you.
 *
 * Steps that point at something real cut a hole in the scrim over it, so the
 * thing being described is the actual thing on screen rather than a picture of
 * one. Steps that don't simply speak.
 */
interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Screens where an unprompted walkthrough would be an intrusion: the doors,
 * and the blank page someone may already be writing on.
 */
const NEVER_HERE = ["/welcome", "/unlock", "/offline", "/capture"];

/** The visible one, when a target renders in both the phone and laptop bars. */
function visibleRect(selector: string): Rect | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  for (const n of nodes) {
    const r = n.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
}

export default function Tour({
  force = false,
  onClose,
}: {
  force?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(force);

  // A forced replay claims her the moment it mounts.
  useEffect(() => {
    if (!force) return;
    maya.claim();
    return () => maya.release();
  }, [force]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [name, setName] = useState<string | undefined>();
  const spoken = useRef<string | null>(null);

  const step = STEPS[Math.min(index, STEPS.length - 1)];

  useEffect(() => {
    if (force) return;
    if (NEVER_HERE.some((p) => pathname.startsWith(p))) return;
    let cancelled = false;
    void (async () => {
      if (!(await shouldRunTour())) return;
      const at = await tourProgress();
      if (cancelled) return;
      setIndex(Math.min(at, STEPS.length - 1));
      // Claim her now rather than when the card appears: her greeting is
      // already on its way, and it would otherwise arrive underneath.
      maya.claim();
      window.setTimeout(() => {
        if (cancelled) {
          maya.release();
          return;
        }
        setOpen(true);
      }, 1200);
    })();
    return () => {
      cancelled = true;
    };
  }, [force, pathname]);

  useEffect(() => {
    void getSetting("displayName").then((n) => setName(n || undefined));
  }, []);

  // Follow the target if the layout shifts under us.
  useEffect(() => {
    if (!open || !step.target) {
      setRect(null);
      return;
    }
    const measure = () => setRect(visibleRect(step.target as string));
    measure();
    const t = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  // She reads it aloud when her voice is on — the same voice as everywhere
  // else. Never before she has asked, though: speech that starts unbidden in
  // someone's first minute is startling, and asking is itself part of meeting
  // her.
  useEffect(() => {
    if (!open || spoken.current === step.id) return;
    if (step.voiceChoice) return;
    spoken.current = step.id;
    maya.speakAside(step.body);
  }, [open, step, index]);

  const close = useCallback(
    async (complete: boolean) => {
      setOpen(false);
      maya.stopSpeaking();
      maya.release();
      if (complete) await finishTour();
      else await saveTourProgress(index);
      onClose?.();
    },
    [index, onClose],
  );

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) {
      void close(true);
      return;
    }
    const at = index + 1;
    setIndex(at);
    void saveTourProgress(at);
  }, [index, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const title =
    step.id === "hello" && name ? `Hello, ${name}. I'm Maya.` : step.title;
  const last = index >= STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60]"
        role="dialog"
        aria-modal="true"
        aria-label="A look around biblio"
      >
        {/* The scrim, with a hole cut in it when there's something to point at. */}
        {rect ? (
          <motion.div
            layout
            className="pointer-events-none absolute rounded-2xl"
            style={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
              boxShadow: "0 0 0 9999px rgb(var(--ink) / 0.55)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" />
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 sm:mx-auto sm:max-w-md sm:pb-10">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-hairline/70 bg-surface p-6 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <MayaOrb size={30} />
              <h2 className="font-serif text-xl leading-tight text-ink">{title}</h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>

            {step.action && (
              <Link
                href={step.action.href}
                onClick={() => void close(false)}
                className="mt-4 inline-block rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
              >
                {step.action.label}
              </Link>
            )}

            {step.voiceChoice ? (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    maya.setVoice("");
                    next();
                  }}
                  className="flex-1 rounded-full border border-hairline bg-paper/50 px-4 py-3 text-sm text-muted"
                >
                  Text is fine
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Turning her on must not undo a voice someone has already
                    // chosen. "Auto" is a starting point for people who have
                    // never picked one, not an answer to "yes please".
                    if (maya.voiceSetting() === "") maya.setVoice("auto");
                    maya.prime();
                    // Speak the NEXT card here, inside the tap — iOS only
                    // allows speech to begin from a real gesture, and an
                    // effect firing after the render is already too late.
                    // Saying a throwaway line instead would only cancel itself
                    // when the next card arrived.
                    const upcoming = STEPS[Math.min(index + 1, STEPS.length - 1)];
                    if (upcoming) {
                      spoken.current = upcoming.id;
                      maya.speakAside(upcoming.body);
                    }
                    next();
                  }}
                  className="flex-1 rounded-full bg-ink/90 px-4 py-3 text-sm font-medium text-paper"
                >
                  Yes, read aloud
                </button>
              </div>
            ) : (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void close(false)}
                className="text-xs text-muted/80 underline-offset-2 hover:text-ink hover:underline"
              >
                {last ? "Close" : "Skip for now"}
              </button>

              <div className="flex items-center gap-3">
                <span aria-hidden className="text-xs text-muted/60">
                  {index + 1}/{STEPS.length}
                </span>
                <button
                  type="button"
                  onClick={next}
                  className="rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform active:scale-95"
                >
                  {last ? "Start writing" : "Go on"}
                </button>
              </div>
            </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
