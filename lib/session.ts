"use client";

import { db } from "./db";
import type { SessionRow } from "./db";

/**
 * Sessions — periods of *attended* use, not tab-open time.
 *
 * The clock runs only while the document is visible, pauses the instant it is
 * hidden, and is clamped so a sleeping laptop can never inject six hours. When
 * someone is visible but perfectly still we credit a short reading window past
 * their last interaction and then stop: a long read still counts, an abandoned
 * tab contributes a couple of minutes rather than a night.
 *
 * The honest version of this asks rather than infers — Maya's presence check,
 * see docs/sessions.md. `onIdle` is where that hooks in; until then, idle
 * simply stops the clock.
 *
 * Nothing here is synced. What may eventually leave the device is aggregates,
 * never this timeline.
 */

/** Continuous pause after which the next visit is a NEW session. */
const GAP_MS = 30 * 60_000;
/** Below this, it was navigation rather than use. */
const MIN_MS = 10_000;
/** Stillness (while visible) after which we stop believing anyone is there. */
const IDLE_MS = 5 * 60_000;
/** How much of that stillness still counts — enough for a long read. */
const IDLE_CREDIT_MS = 2 * 60_000;
const TICK_MS = 15_000;

interface Live {
  id: string;
  startedAt: number;
  activeMs: number;
  entriesWritten: number;
}

let live: Live | null = null;
let lastTick = 0;
let lastInteraction = 0;
let hiddenAt = 0;
let idle = false;
let tickTimer: number | null = null;
let started = false;

const startListeners = new Set<() => void>();
const idleListeners = new Set<() => void>();

const visible = () => typeof document !== "undefined" && document.visibilityState === "visible";

/**
 * Add the time since the last mark — but only the attended part of it. Two
 * guards: nothing accrues past the reading credit, and any single delta longer
 * than the idle threshold is discarded outright as a suspend rather than
 * counted as presence.
 */
function accrue(now = Date.now()): void {
  if (!live || !visible()) {
    lastTick = now;
    return;
  }
  const ceiling = Math.max(lastTick, lastInteraction + IDLE_CREDIT_MS);
  const upto = Math.min(now, ceiling);
  const delta = upto - lastTick;
  if (delta > 0 && delta <= IDLE_MS) live.activeMs += delta;
  lastTick = now;
}

function begin(now = Date.now()): void {
  live = { id: crypto.randomUUID(), startedAt: now, activeMs: 0, entriesWritten: 0 };
  lastTick = now;
  lastInteraction = now;
  idle = false;
  startListeners.forEach((cb) => cb());
}

async function end(now = Date.now()): Promise<void> {
  if (!live) return;
  accrue(now);
  const row: SessionRow = {
    id: live.id,
    startedAt: live.startedAt,
    endedAt: now,
    activeMs: live.activeMs,
    entriesWritten: live.entriesWritten,
  };
  live = null;
  if (row.activeMs >= MIN_MS) {
    try {
      await db.sessions.put(row);
    } catch {
      /* a session we cannot store is not worth interrupting anyone over */
    }
  }
}

function touch(): void {
  lastInteraction = Date.now();
  idle = false;
}

function tick(): void {
  const now = Date.now();
  accrue(now);
  if (live && visible() && !idle && now - lastInteraction > IDLE_MS) {
    idle = true;
    idleListeners.forEach((cb) => cb());
  }
}

function onVisibility(): void {
  const now = Date.now();
  if (visible()) {
    // Away longer than the gap makes this a new session, not a continuation.
    if (hiddenAt && now - hiddenAt > GAP_MS) {
      void end(hiddenAt).then(() => begin(now));
    } else {
      lastTick = now;
      touch();
    }
    hiddenAt = 0;
  } else {
    accrue(now);
    hiddenAt = now;
  }
}

/** Start tracking. Idempotent; safe to call from any client component. */
export function startSessions(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  begin();
  for (const evt of ["pointerdown", "keydown", "scroll", "touchstart", "wheel"]) {
    window.addEventListener(evt, touch, { passive: true });
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", () => void end());
  tickTimer = window.setInterval(tick, TICK_MS);
}

export function stopSessions(): void {
  if (tickTimer) window.clearInterval(tickTimer);
  tickTimer = null;
  void end();
  started = false;
}

/** Fires when a NEW session begins — the definition of "a distinct visit". */
export function onSessionStart(cb: () => void): () => void {
  startListeners.add(cb);
  return () => startListeners.delete(cb);
}

/** Fires when someone has been visible but perfectly still for a while. */
export function onIdle(cb: () => void): () => void {
  idleListeners.add(cb);
  return () => idleListeners.delete(cb);
}

export function noteEntryWritten(): void {
  if (live) live.entriesWritten++;
}

/** Attended time in the current session so far, in ms. */
export function activeMs(): number {
  accrue();
  return live?.activeMs ?? 0;
}

export function sessionStartedAt(): number | null {
  return live?.startedAt ?? null;
}
