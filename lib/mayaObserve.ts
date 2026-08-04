"use client";

import type { JournalEntry } from "./types";

/**
 * What Maya notices.
 *
 * Every observation is computed here, on the device, from the journal already
 * in IndexedDB — nothing is sent anywhere and no model is called. She only
 * speaks when the data genuinely supports it: each rule has a threshold, and
 * when none is met she says nothing rather than inventing a pattern. That is
 * what keeps "quietly observant" from becoming "unsettling".
 */
export interface Observation {
  /** What she'd say. */
  text: string;
  /** Higher wins when several rules fire at once. */
  weight: number;
}

const DAY = 86_400_000;

const COUNT_WORD = ["", "", "Twice", "Three times", "Four times", "Five times", "Six times"];
const ORDINAL = ["", "", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];

function partOfDay(ts: number, timezone?: string): "morning" | "afternoon" | "evening" | "night" {
  const hour = Number(
    new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: timezone }).format(ts),
  );
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/** Distinct calendar days present in a list of timestamps. */
function distinctDays(times: number[]): Set<string> {
  return new Set(times.map((t) => new Date(t).toDateString()));
}

/**
 * Everything Maya could honestly say right now, best first. Returns an empty
 * list when the journal is too young to have patterns — the caller then falls
 * back to a warm, unobservant line.
 */
export function observe(entries: JournalEntry[], now = Date.now()): Observation[] {
  const real = entries.filter((e) => !e.id.startsWith("demo-"));
  const out: Observation[] = [];
  if (real.length === 0) return out;

  const sorted = [...real].sort((a, b) => b.createdAt - a.createdAt);
  const week = sorted.filter((e) => now - e.createdAt < 7 * DAY);
  const fortnight = sorted.filter((e) => now - e.createdAt < 14 * DAY);

  // A gap worth gently naming — she never scolds.
  const sinceLast = Math.floor((now - sorted[0].createdAt) / DAY);
  if (sinceLast >= 4) {
    out.push({
      text:
        sinceLast >= 14
          ? `It's been a while — ${sinceLast} days. The page kept your place.`
          : `${sinceLast} days since you last wrote. No hurry.`,
      weight: 8,
    });
  }

  // A theme circling back through the week.
  if (week.length >= 3) {
    const themes = new Map<string, number>();
    for (const e of week) {
      for (const t of new Set(e.themes.map((x) => x.toLowerCase()))) {
        themes.set(t, (themes.get(t) ?? 0) + 1);
      }
    }
    const [theme, count] = [...themes.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (count >= 3) {
      out.push({
        text: `${COUNT_WORD[Math.min(count, 6)]} this week you've written about ${theme}.`,
        weight: 7,
      });
    }
  }

  // When the writing tends to happen.
  if (week.length >= 3) {
    const slots = new Map<string, number>();
    for (const e of week) {
      const p = partOfDay(e.createdAt, e.timezone);
      slots.set(p, (slots.get(p) ?? 0) + 1);
    }
    const [slot, count] = [...slots.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const nowSlot = partOfDay(now);
    if (count >= 3 && slot === nowSlot) {
      out.push({
        text: `${ORDINAL[Math.min(count, 7)]} ${slot} this week you've come here.`,
        weight: 6,
      });
    }
  }

  // A mood that keeps returning.
  if (fortnight.length >= 4) {
    const moods = new Map<string, number>();
    for (const e of fortnight) {
      const m = e.mood.toLowerCase().split(",")[0].trim();
      if (m && m !== "neutral") moods.set(m, (moods.get(m) ?? 0) + 1);
    }
    const [mood, count] = [...moods.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (count >= 3) {
      out.push({ text: `"${mood}" keeps coming back lately.`, weight: 5 });
    }
  }

  // Consecutive days, counted back from today or yesterday.
  const days = distinctDays(sorted.map((e) => e.createdAt));
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * DAY).toDateString();
    if (days.has(d)) streak++;
    else if (i > 0) break;
  }
  if (streak >= 3) {
    out.push({ text: `${streak} days running. That's a rhythm.`, weight: 9 });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/** A milestone line for a freshly-saved entry, if this one is a landmark. */
export function milestoneFor(total: number): string | null {
  if (total === 1) return "Your first page. The hardest one is behind you.";
  if (total === 5) return "Five entries. It's becoming a book.";
  if (total === 10) return "Ten. This is a habit now.";
  if (total === 25) return "Twenty-five entries kept.";
  if (total === 50) return "Fifty. A proper volume.";
  if (total === 100) return "A hundred entries. Quite a story.";
  return null;
}
