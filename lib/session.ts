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
/** How much stillness counts unasked — enough for a long read. */
const IDLE_CREDIT_MS = 2 * 60_000;
/** No single delta longer than this is believable as attendance. */
const CLAMP_MS = 5 * 60_000;
const TICK_MS = 15_000;
/** Stillness before she asks. Settable; 0 means never ask. */
const IDLE_KEY = "biblio_idle_min";
const DEFAULT_IDLE_MIN = 10;

export function idleMinutes(): number {
  try {
    const raw = localStorage.getItem(IDLE_KEY);
    if (raw === null) return DEFAULT_IDLE_MIN;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_IDLE_MIN;
  } catch {
    return DEFAULT_IDLE_MIN;
  }
}

export function setIdleMinutes(n: number): void {
  try {
    localStorage.setItem(IDLE_KEY, String(n));
  } catch {
    /* private mode */
  }
}

/**
 * The window grows each time they confirm. Someone who has said "still here"
 * twice is settled in with a long entry, and asking six times in an hour is
 * exactly how this stops being kind.
 */
function idleWindowMs(): number {
  const base = idleMinutes();
  if (base <= 0) return 0;
  return base * 60_000 * (1 + Math.min(confirmations, 2));
}

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
let confirmations = 0;
let tickTimer: number | null = null;
let started = false;

const startListeners = new Set<() => void>();
const idleListeners = new Set<() => void>();
const presentListeners = new Set<() => void>();

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
  if (delta > 0 && delta <= CLAMP_MS) live.activeMs += delta;
  lastTick = now;
}

function begin(now = Date.now()): void {
  live = { id: crypto.randomUUID(), startedAt: now, activeMs: 0, entriesWritten: 0 };
  lastTick = now;
  lastInteraction = now;
  idle = false;
  confirmations = 0;
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
  // Short, but it produced an entry — and the entry count is read back from
  // these rows, so dropping the row loses the one thing worth keeping.
  if (row.activeMs >= MIN_MS || row.entriesWritten > 0) {
    try {
      await db.sessions.put(row);
    } catch {
      /* a session we cannot store is not worth interrupting anyone over */
    }
  }
}

/**
 * The stillness they just ended was attended after all — they confirmed it at
 * the end of it. That is the whole reason for asking rather than guessing: the
 * only uncertain minutes we ever count are the ones someone vouched for.
 */
function creditIdleSpan(now: number): void {
  if (!live) return;
  const uncredited = now - (lastInteraction + IDLE_CREDIT_MS);
  if (uncredited > 0) live.activeMs += uncredited;
}

function touch(): void {
  const now = Date.now();
  if (!live && started && visible()) {
    // The last session ended while they were away. Coming back — by any
    // means, not only by switching tabs — starts a new one.
    begin(now);
    return;
  }
  if (idle) {
    creditIdleSpan(now);
    confirmations++;
    idle = false;
    presentListeners.forEach((cb) => cb());
  }
  lastInteraction = now;
  lastTick = now;
}

/** They answered. Same as any other sign of life. */
export function confirmPresence(): void {
  touch();
}

/**
 * Nobody answered. The session ends at the last real interaction, so the
 * minutes they were not there never enter the total.
 */
export async function markAbsent(): Promise<void> {
  idle = false;
  await end(lastInteraction + IDLE_CREDIT_MS);
  hiddenAt = Date.now();
}

function tick(): void {
  const now = Date.now();
  accrue(now);
  const window = idleWindowMs();
  if (window > 0 && live && visible() && !idle && now - lastInteraction > window) {
    idle = true;
    idleListeners.forEach((cb) => cb());
  }
}

function onVisibility(): void {
  const now = Date.now();
  if (visible()) {
    // Away longer than the gap makes this a new session, not a continuation.
    if (!live || (hiddenAt && now - hiddenAt > GAP_MS)) {
      void end(hiddenAt || now).then(() => begin(now));
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

/** Fires when a stillness ends — however they showed they were there. */
export function onPresent(cb: () => void): () => void {
  presentListeners.add(cb);
  return () => presentListeners.delete(cb);
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

/**
 * The session in progress, which is *not* in `db.sessions` — a row is written
 * when a session ends, and a session ends as the page is being taken away.
 * Anything that counts today's use has to add this in, or a visit that never
 * comes back records nothing at all.
 */
export function liveSession(): { startedAt: number; activeMs: number; entriesWritten: number } | null {
  if (!live) return null;
  accrue();
  return { startedAt: live.startedAt, activeMs: live.activeMs, entriesWritten: live.entriesWritten };
}
