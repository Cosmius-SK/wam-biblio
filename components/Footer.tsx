"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { maya, type MayaLine } from "@/lib/maya";
import FooterQuote from "./FooterQuote";

/**
 * The foot of every page, and Maya's home.
 *
 * By default it holds the day's quotation. When Maya has something to say she
 * takes the space — orb and words — and when she's finished the quotation
 * returns. The quote stays mounted underneath the whole time, so it never has
 * to be fetched again just to come back.
 */
export default function Footer() {
  const [line, setLine] = useState<MayaLine | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const unLine = maya.subscribe(setLine);
    const unSpeaking = maya.onSpeaking(setSpeaking);
    return () => {
      unLine();
      unSpeaking();
    };
  }, []);

  return (
    // Anchored like the header: the quotation, and Maya, always in the same
    // place rather than scrolling away with the journal. Full width so the
    // blur spans the screen, with the words held to a reading column.
    <footer className="fixed inset-x-0 bottom-0 z-30 backdrop-blur-md">
      <div
        className="relative mx-auto min-h-[3.5rem] max-w-2xl px-5 pb-5 pt-3 text-center"
        aria-live="polite"
      >
        <div
          className={`transition-opacity duration-700 ${line ? "opacity-0" : "opacity-100"}`}
          aria-hidden={!!line}
        >
          <FooterQuote />
        </div>

        <AnimatePresence>
          {line && (
            <motion.button
              key={line.id}
              type="button"
              onClick={() => {
                maya.stopSpeaking();
                // A question is answered by being touched at all — the chips
                // are the affordance, not a hoop.
                if (line.answers) maya.answer();
                else maya.dismiss();
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              aria-label={line.answers ? "Still here" : "Dismiss"}
              className="absolute inset-0 flex items-center justify-center gap-3"
            >
              <span
                aria-hidden
                className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-terracotta/70 via-lavender/70 to-sage/70 ${
                  speaking ? "animate-pulse-soft" : "animate-breathe"
                }`}
              />
              <span className="font-serif text-base italic leading-snug text-ink/90">
                {line.text}
              </span>
              {line.answers && (
                <span className="flex shrink-0 items-center gap-1.5">
                  {line.answers.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-hairline bg-surface/70 px-2.5 py-1 text-sm leading-none text-ink/80"
                    >
                      {a}
                    </span>
                  ))}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
}
