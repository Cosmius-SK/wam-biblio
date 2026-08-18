"use client";

import { useCallback, useEffect, useState } from "react";
import { NEVER_COLLECTED } from "@/lib/insights/schema";
import { insightsOff, recentTotals, setInsightsOff } from "@/lib/insights/collect";
import type { DailyInsight } from "@/lib/insights/schema";

/**
 * Settings › Privacy.
 *
 * A promise nobody can check is just a sentence. This shows the actual record —
 * the same numbers that would be sent, computed the same way — alongside the
 * list of what is never gathered, and a switch that stops it.
 */
export default function PrivacyCard() {
  const [days, setDays] = useState<DailyInsight[] | null>(null);
  const [off, setOff] = useState(false);

  const load = useCallback(async () => {
    setOff(insightsOff());
    setDays(await recentTotals(7));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(next: boolean) {
    setOff(next);
    setInsightsOff(next);
  }

  const nothingYet = days?.every((d) => d.entries === 0 && d.activeMinutes === 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">What biblio knows about you</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Two numbers a day: how many entries you wrote, and how long you spent here. That
          is the entire list, and this is the actual record — not a description of it.
        </p>

        {days === null ? (
          <p className="mt-4 text-sm text-muted">Looking…</p>
        ) : nothingYet ? (
          <p className="mt-4 text-sm text-muted">Nothing yet this week.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline/50 overflow-hidden rounded-xl border border-hairline/60">
            {days
              .filter((d) => d.entries > 0 || d.activeMinutes > 0)
              .map((d) => (
                <li key={d.date} className="flex items-center justify-between bg-paper/40 px-4 py-2.5">
                  <span className="text-sm text-muted">{d.date}</span>
                  <span className="text-sm text-ink/80">
                    {d.entries} {d.entries === 1 ? "entry" : "entries"} · {d.activeMinutes} min
                  </span>
                </li>
              ))}
          </ul>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-hairline/60 bg-paper/40 p-4">
          <input
            type="checkbox"
            checked={off}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-lavender"
          />
          <span className="text-sm leading-relaxed text-muted">
            <span className="text-ink/80">Keep these numbers on this device.</span> Nothing is
            sent. biblio works exactly the same either way — the numbers only exist to show
            whether the app is worth anyone&rsquo;s time.
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">What is never collected</h2>
        <ul className="mt-3 space-y-2">
          {NEVER_COLLECTED.map((n) => (
            <li key={n} className="flex gap-2.5 text-sm text-muted">
              <span aria-hidden className="text-sage">
                —
              </span>
              {n}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted/80">
          Moods and themes are on that list on purpose. They look like plain metadata, but
          they are worked out from what you wrote — and they would say more about your week
          than a paragraph would.
        </p>
      </div>

      <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Why you can believe it</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your journal is encrypted on this device before any of it leaves. Whoever runs
          biblio holds nothing but unreadable text and the two numbers above — not by
          promise, but because there is no key on any server to read it with.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Photos go to <span className="text-ink/80">your own</span> Google Drive, encrypted,
          counted against your storage and invisible to anyone else.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted/80">
          The one place you write <em>to</em> anyone is Maya&rsquo;s feedback box, and it says
          so every time. Nothing else you write is ever read.
        </p>
      </div>
    </div>
  );
}
