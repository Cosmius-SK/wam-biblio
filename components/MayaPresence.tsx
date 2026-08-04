"use client";

import { useEffect } from "react";
import { maya } from "@/lib/maya";
import { db, getSetting } from "@/lib/db";
import { greetingLine, OBSERVANT_FROM } from "@/lib/mayaLines";
import { observe } from "@/lib/mayaObserve";

/**
 * Maya's sense of timing. She has no markup of her own — the footer is where
 * she appears (see components/Footer.tsx); this only decides when she has
 * something worth saying.
 *
 * On the first open of a day she greets, and follows it with one honest
 * observation if the journal is old enough to have any.
 */
export default function MayaPresence() {
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

  return null;
}
