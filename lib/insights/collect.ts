"use client";

import { db } from "../db";
import { deviceId } from "../deviceId";
import { liveSession } from "../session";
import { COLLECT_ANSWERS, OPT_OUT_KEY, type DailyInsight } from "./schema";

/**
 * Client-side collection. Numbers only, computed locally, sent as **absolute
 * daily totals** rather than increments — so a retry, a double send or a lost
 * response can never inflate anything, and each device writes its own slot.
 *
 * The raw session timeline never leaves. Only the sum does.
 *
 * Two things about *when* this is computed, both learned the hard way. The
 * session in progress is not in `db.sessions` — a row lands there when the
 * session ends, which is as the page is being taken away — so it has to be
 * added in by hand, or somebody who opens biblio once, writes, and closes it
 * records nothing at all. And the send has to survive that same moment, which
 * is what `beaconToday` is for.
 */

/** Below this, it was a navigation rather than a visit. Mirrors lib/session. */
const MIN_MS = 10_000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayBounds(date: string): [number, number] {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  return [start, start + 24 * 60 * 60 * 1000];
}

export function insightsOff(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setInsightsOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * The day's numbers, and the milliseconds behind the minutes.
 *
 * Entries are counted from the *sessions*, not from the journal. Counting the
 * journal counts entries that arrived by sync as well as ones written here, so
 * a person with a phone and a laptop reported the same entry twice and the
 * owner's page added them up. "Entries written on this device" is what the
 * schema promises, and a session is the only record of where writing happened.
 */
async function dayDetail(date: string): Promise<DailyInsight & { activeMs: number }> {
  const [from, to] = dayBounds(date);
  const sessions = await db.sessions.where("startedAt").between(from, to, true, false).toArray();
  let activeMs = sessions.reduce((sum, s) => sum + (s.activeMs || 0), 0);
  let entries = sessions.reduce((sum, s) => sum + (s.entriesWritten || 0), 0);

  const open = liveSession();
  if (open && open.startedAt >= from && open.startedAt < to) {
    activeMs += open.activeMs;
    entries += open.entriesWritten;
  }
  return { date, device: deviceId(), entries, activeMs, activeMinutes: Math.round(activeMs / 60_000) };
}

/** Exactly what would be sent for a given day — the privacy page shows this. */
export async function dailyTotals(date = today()): Promise<DailyInsight> {
  const { activeMs: _ms, ...totals } = await dayDetail(date);
  return totals;
}

/** The last `days` days of what this device holds, newest first. */
export async function recentTotals(days = 7): Promise<DailyInsight[]> {
  const out: DailyInsight[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push(await dailyTotals(d));
  }
  return out;
}

/**
 * The presence-check answer.
 *
 * Deliberately inert. The guard is here, at the point of recording, so that
 * "we're not collecting it yet" means nothing is written down — not that
 * something is written down and held back.
 */
export function noteAnswer(_surface: string, _answer: string): void {
  if (!COLLECT_ANSWERS) return;
  // Intentionally unimplemented. See docs/user-management/privacy.md: turning
  // this on needs its own disclosure, and it starts from that day.
}

/**
 * The last totals computed, kept so the page can be left in a hurry.
 *
 * `entries` needs a database read and the page being closed does not wait for
 * one, so the count is taken from here and only the clock — which is in
 * memory — is read fresh at the last moment.
 */
let snapshot: { date: string; device: string; entries: number; storedMs: number } | null = null;

/** Worth a row? A visit is, even when both numbers round down to nothing. */
function worthSending(entries: number, activeMs: number): boolean {
  return entries > 0 || activeMs >= MIN_MS;
}

/** Send today's totals. Silent, best effort, and skipped entirely when off. */
export async function sendToday(): Promise<void> {
  if (insightsOff()) return;
  try {
    const { activeMs, ...body } = await dayDetail(today());
    const open = liveSession();
    snapshot = {
      date: body.date,
      device: body.device,
      entries: body.entries,
      storedMs: activeMs - (open?.activeMs ?? 0),
    };
    // Minutes are rounded, so a three-minute look around used to report
    // "0 and 0" and be dropped here as nothing — which is how a tester who
    // did turn up read, on the owner's page, as a tester who never came.
    if (!worthSending(body.entries, activeMs)) return;
    await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* nothing here is worth a retry, let alone an error message */
  }
}

/**
 * Today's totals, sent in the one way that survives the page going away.
 *
 * A phone switching apps freezes the document and an in-flight `fetch` dies
 * with it — which is why the numbers from a phone were the ones going missing.
 * `sendBeacon` hands the body to the browser to deliver afterwards. Everything
 * here is synchronous on purpose: an `await` at this moment is a bet that the
 * page will still be running when it resolves.
 */
export function beaconToday(): void {
  if (insightsOff() || !snapshot || snapshot.date !== today()) return;
  const open = liveSession();
  const activeMs = snapshot.storedMs + (open?.activeMs ?? 0);
  const entries = snapshot.entries;
  if (!worthSending(entries, activeMs)) return;
  const body: DailyInsight = {
    date: snapshot.date,
    device: snapshot.device,
    entries,
    activeMinutes: Math.round(activeMs / 60_000),
  };
  try {
    const payload = new Blob([JSON.stringify(body)], { type: "application/json" });
    navigator.sendBeacon?.("/api/insights", payload);
  } catch {
    /* nothing to fall back to at this point in a page's life */
  }
}
