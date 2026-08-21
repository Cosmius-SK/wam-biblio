"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { maya, type MayaLine } from "@/lib/maya";
import FooterQuote from "./FooterQuote";
import MayaOrb from "./MayaOrb";

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

  useEffect(() => {
    const unLine = maya.subscribe(setLine);
    return () => {
      unLine();
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
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center gap-3"
            >
              <button
                type="button"
                onClick={() => {
                  maya.stopSpeaking();
                  // Touching the words at all is an answer; the marks are an
                  // affordance, not a hoop.
                  if (line.answers) maya.answer();
                  else maya.dismiss();
                }}
                aria-label={line.answers ? "Still here" : "Dismiss"}
                className="flex min-w-0 items-center gap-3"
              >
                <MayaOrb size={26} />
                <span className="font-serif text-base italic leading-snug text-ink/90">
                  {line.text}
                </span>
              </button>

              {line.answers?.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    maya.stopSpeaking();
                    maya.answer(a);
                  }}
                  aria-label={`Still here — ${a}`}
                  className="shrink-0 rounded-full border border-hairline bg-surface/70 px-2.5 py-1 text-sm leading-none text-ink/80 transition-transform active:scale-95"
                >
                  {a}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
}
