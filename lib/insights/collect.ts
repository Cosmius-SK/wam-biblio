"use client";

import { db } from "../db";
import { deviceId } from "../deviceId";
import { COLLECT_ANSWERS, OPT_OUT_KEY, type DailyInsight } from "./schema";

/**
 * Client-side collection. Numbers only, computed locally, sent as **absolute
 * daily totals** rather than increments — so a retry, a double send or a lost
 * response can never inflate anything, and each device writes its own slot.
 *
 * The raw session timeline never leaves. Only the sum does.
 */
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

/** Exactly what would be sent for a given day — the privacy page shows this. */
export async function dailyTotals(date = today()): Promise<DailyInsight> {
  const [from, to] = dayBounds(date);
  const sessions = await db.sessions.where("startedAt").between(from, to, true, false).toArray();
  const activeMs = sessions.reduce((sum, s) => sum + (s.activeMs || 0), 0);
  // recordedAt is when it was actually kept; createdAt can be backdated by the
  // writer, and "wrote something today" should mean today.
  const entries = (await db.entries.toArray()).filter((e) => {
    const at = e.recordedAt ?? e.createdAt;
    return !e.id.startsWith("demo-") && at >= from && at < to;
  }).length;
  return {
    date,
    device: deviceId(),
    entries,
    activeMinutes: Math.round(activeMs / 60_000),
  };
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

/** Send today's totals. Silent, best effort, and skipped entirely when off. */
export async function sendToday(): Promise<void> {
  if (insightsOff()) return;
  try {
    const body = await dailyTotals();
    if (body.entries === 0 && body.activeMinutes === 0) return;
    await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* nothing here is worth a retry, let alone an error message */
  }
}
