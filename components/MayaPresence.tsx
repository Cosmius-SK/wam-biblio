"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { maya, type MayaLine } from "@/lib/maya";
import { db, getSetting } from "@/lib/db";
import { greetingLine, sparseLine, OBSERVANT_FROM } from "@/lib/mayaLines";
import { observe } from "@/lib/mayaObserve";

/**
 * Maya, made visible: the breathing orb and, beside it, whatever she has to
 * say. She is a quiet companion, so this is empty almost all the time — it
 * appears at moments that matter and fades away again.
 *
 * Mounted once in the root layout. On the first open of a day she greets, and
 * offers one honest observation if the journal is old enough to have any.
 */
export default function MayaPresence() {
  const [line, setLine] = useState<MayaLine | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const unLine = maya.subscribe(setLine);
    const unSpeak = maya.onSpeaking(setSpeaking);
    return () => {
      unLine();
      unSpeak();
    };
  }, []);

  // The day's first hello — and, if the journal has earned it, a noticing.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || !maya.shouldGreetToday()) return;
      const [name, entries] = await Promise.all([
        getSetting("displayName"),
        db.entries.toArray(),
      ]);
      if (cancelled) return;
      const real = entries.filter((e) => !e.id.startsWith("demo-"));
      maya.say(greetingLine(name), "greeting", 6500);

      if (real.length < OBSERVANT_FROM) return; // nothing honest to notice yet
      const found = observe(real);
      if (found.length === 0) return;
      const follow = window.setTimeout(() => {
        if (!cancelled) maya.say(found[0].text, "observation", 8000);
      }, 8000);
      return () => window.clearTimeout(follow);
    }, 1400); // let the page settle first

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-6"
    >
      <AnimatePresence>
        {line && (
          <motion.button
            key={line.id}
            type="button"
            onClick={() => {
              maya.stopSpeaking();
              maya.dismiss();
            }}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            aria-label="Dismiss"
            className="paper-surface pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-hairline/70 bg-surface/90 py-2.5 pl-3 pr-5 text-left shadow-page backdrop-blur-md"
          >
            <span
              aria-hidden
              className={`h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-terracotta/60 via-lavender/60 to-sage/60 ${
                speaking ? "animate-pulse-soft" : "animate-breathe"
              }`}
            />
            <span className="font-serif text-base italic leading-snug text-ink/90">
              {line.text}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A warm, unobservant aside — used when the journal is too young to notice. */
export function saySomethingKind(): void {
  maya.say(sparseLine(), "observation", 5000);
}
