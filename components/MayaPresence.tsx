"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { maya } from "@/lib/maya";
import { db, getSetting } from "@/lib/db";
import { draftNudgeLine, greetingLine, presenceAsk, surfaceOf, OBSERVANT_FROM } from "@/lib/mayaLines";
import { observe } from "@/lib/mayaObserve";
import { confirmPresence, markAbsent, onIdle, onPresent, onSessionStart } from "@/lib/session";
import { flushDraft, loadDraft } from "@/lib/drafts";
import { noteAnswer } from "@/lib/insights/collect";
import { agoLabel } from "@/lib/format";
import { isBiometricEnabled, relock } from "@/lib/biometric";

/** A draft has to have been sitting a while before mentioning it is helpful. */
const NUDGE_AFTER_MS = 30 * 60_000;
const NUDGE_KEY = "biblio_draft_nudged";

/**
 * Maya's sense of timing. She has no markup of her own — the footer is where
 * she appears (see components/Footer.tsx); this only decides when she has
 * something worth saying.
 *
 * On the first open of a day she greets, and follows it with one honest
 * observation if the journal is old enough to have any.
 *
 * She also asks whether anyone is still there once a visit has gone quiet, and
 * mentions an unfinished draft on a new visit — both from here, because both
 * are questions of timing rather than of any one screen.
 */
export default function MayaPresence() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // iOS only lets speech start from a user gesture, and suspends it whenever
  // the page is backgrounded — waking it on the first tap makes her audible.
  useEffect(() => {
    const wake = () => maya.prime();
    window.addEventListener("pointerdown", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let follow: number | undefined;

    const timer = window.setTimeout(async () => {
      if (cancelled || !maya.shouldGreetToday()) return;
      const [name, entries] = await Promise.all([
        getSetting("displayName"),
        db.entries.toArray(),
      ]);
      if (cancelled) return;
      maya.say(greetingLine(name), "greeting", 6500);

      const real = entries.filter((e) => !e.id.startsWith("demo-"));
      if (real.length < OBSERVANT_FROM) return; // nothing honest to notice yet
      const found = observe(real);
      if (found.length === 0) return;
      follow = window.setTimeout(() => {
        if (!cancelled) maya.say(found[0].text, "observation", 8000);
      }, 8000);
    }, 1400); // let the page settle first

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (follow) window.clearTimeout(follow);
    };
  }, []);

  // The presence check. Rather than guess whether a still screen means someone
  // is reading or has walked away, she asks — and the answer is what makes the
  // "time spent" number honest.
  useEffect(() => {
    const stopIdle = onIdle(() => {
      void (async () => {
        const name = (await getSetting("displayName")) ?? undefined;
        const { text, answers } = presenceAsk(surfaceOf(pathRef.current), name);
        const surface = surfaceOf(pathRef.current);
        maya.ask(
          text,
          answers,
          (mark) => {
            // Dormant by design: noteAnswer returns immediately while
            // COLLECT_ANSWERS is false, so nothing is written down — not
            // written down and withheld. See lib/insights/schema.ts.
            if (mark) noteAnswer(surface, mark);
            confirmPresence();
          },
          () => {
            void (async () => {
              await flushDraft(true);
              await markAbsent();
              if (await isBiometricEnabled()) relock();
            })();
          },
        );
      })();
    });

    // Any sign of life answers her, not only a tap on the words.
    const stopPresent = onPresent(() => {
      if (maya.awaitingAnswer()) maya.answer();
    });

    return () => {
      stopIdle();
      stopPresent();
    };
  }, []);

  // The unfinished-draft nudge: on a new visit, once a day, and never while
  // they are already looking at it.
  useEffect(() => {
    const stop = onSessionStart(() => {
      void (async () => {
        if (pathRef.current.startsWith("/capture")) return;
        const today = new Date().toDateString();
        try {
          if (localStorage.getItem(NUDGE_KEY) === today) return;
        } catch {
          /* private mode — she'll just mention it once per visit */
        }
        const draft = await loadDraft();
        if (!draft || Date.now() - draft.updatedAt < NUDGE_AFTER_MS) return;
        const name = (await getSetting("displayName")) ?? undefined;
        try {
          localStorage.setItem(NUDGE_KEY, today);
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          maya.say(draftNudgeLine(agoLabel(draft.updatedAt), name), "nudge", 8000);
        }, 4000);
      })();
    });
    return stop;
  }, []);

  return null;
}

