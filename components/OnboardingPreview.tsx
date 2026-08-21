"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { restartTour } from "@/lib/tour";
import { PROMPTS } from "@/lib/feedback";
import Tour from "./tour/Tour";

/**
 * Owner-only: see the first-run experience again.
 *
 * Most of what a new person meets happens **once**, on purpose — the
 * walkthrough, Maya's first question, the what's-new card. That is right for
 * them and useless for whoever has to check it, so this puts those flags back.
 *
 * It cannot show the whole thing. Signing in pulls a journal down, and biblio
 * then correctly decides this is not someone new — so the genuine first run,
 * door included, needs a second Google account. Said plainly below rather than
 * quietly approximated.
 */
export default function OnboardingPreview() {
  const [tour, setTour] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function resetFirstRun() {
    await restartTour();
    for (const p of PROMPTS) await db.settings.delete(`askedFeedback:${p.id}`);
    try {
      localStorage.removeItem("biblio_seen_version");
      localStorage.removeItem("biblio_draft_nudged");
    } catch {
      /* private mode */
    }
    setNote("Reset. The walkthrough, Maya's questions and the what's-new card will all happen again.");
  }

  return (
    <div className="rounded-2xl border border-hairline/60 bg-surface/60 p-5">
      <h2 className="font-serif text-xl text-ink">See it as someone new</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The parts that happen only once — the walkthrough, Maya&rsquo;s first question, the
        note about what changed — can be put back here, as often as you like.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setTour(true)}
          className="rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper transition-transform active:scale-95"
        >
          Watch the walkthrough
        </button>
        <button
          type="button"
          onClick={() => void resetFirstRun()}
          className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Reset everything first-run
        </button>
      </div>

      {note && <p className="mt-3 text-sm text-sage">{note}</p>}

      <p className="mt-5 text-xs leading-relaxed text-muted/80">
        <strong className="font-medium text-muted">What this can&rsquo;t show you.</strong>{" "}
        The door, setting a passcode, the six words, and an empty journal with nothing in it
        — because signing in as yourself brings your journal with you, and biblio is right to
        conclude you are not new. For that, use a second Google account: add it to{" "}
        <code className="text-[0.7rem]">ALLOWED_USERS</code>, sign in on another browser, and
        walk the whole thing. It gets its own key and its own passcode, and touches nothing
        of yours.
      </p>

      {tour && <Tour force onClose={() => setTour(false)} />}
    </div>
  );
}
