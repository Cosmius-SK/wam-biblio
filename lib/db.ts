"use client";

import Dexie, { type Table } from "dexie";
import type { JournalEntry, EntryContext, Portrait, Reflection } from "./types";

/**
 * Local-first store. Entries live in the browser (IndexedDB) and are the
 * source of truth — capture works offline, and nothing leaves the device
 * except the AI calls the user explicitly triggers. Encrypted cloud sync is
 * a later phase (see plan, Phase 4).
 */
interface Setting {
  key: string;
  value: string;
}

/** Per-record sync bookkeeping for differential (delta) sync. `hash` is the
 * last content hash we pushed (or a tombstone marker); `pulledUp` is the remote
 * uploadedAt (ms) we last pulled, so unchanged records aren't re-fetched. */
export interface SyncLedgerRow {
  key: string; // record id
  type: "e" | "p" | "r" | "k";
  hash: string;
  pulledUp: number;
}

/** One logged AI action on this device — the itemised usage ledger. */
export interface AiLogRow {
  id: string;
  at: number;
  feature: "shape" | "ask" | "reflect" | "illustrate";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Estimated cost in USD (0 for free-tier images). */
  cost: number;
  /** Image count, for illustrate calls (they have no token usage). */
  images?: number;
}

class JournalDB extends Dexie {
  entries!: Table<JournalEntry, string>;
  reflections!: Table<Reflection, string>;
  settings!: Table<Setting, string>;
  portraits!: Table<Portrait, string>;
  syncled!: Table<SyncLedgerRow, string>;
  ailog!: Table<AiLogRow, string>;

  constructor() {
    super("wam-biblio");
    this.version(1).stores({
      // Indexed fields; `themes` is multi-entry for theme/thread views.
      entries: "id, createdAt, mood, *themes",
    });
    // v2 adds saved "state of you" reflections (Phase 2).
    this.version(2).stores({
      reflections: "id, createdAt",
    });
    // v3 adds key-value settings (photo media key, Drive connection state).
    this.version(3).stores({
      settings: "key",
    });
    // v4 adds profile self-portraits for the timelapse.
    this.version(4).stores({
      portraits: "id, capturedAt",
    });
    // v5 adds the per-record sync ledger for differential sync.
    this.version(5).stores({
      syncled: "key",
    });
    // v6 adds the itemised AI usage ledger (per-device; not synced).
    this.version(6).stores({
      ailog: "id, at, feature",
    });
  }
}

export const db = new JournalDB();

/**
 * A lightweight local-change signal so auto-sync can push after any create,
 * update, or delete (counts alone miss edits). Pulls wrap their writes in
 * `suppressSync` so merging a pulled payload doesn't immediately re-push.
 */
type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();
let suppressDepth = 0;

function emitChange() {
  if (suppressDepth === 0) changeListeners.forEach((l) => l());
}

export function onDataChange(cb: ChangeListener): () => void {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

/** Run writes without emitting change events (used while merging a pull). */
export async function suppressSync<T>(fn: () => Promise<T>): Promise<T> {
  suppressDepth++;
  try {
    return await fn();
  } finally {
    suppressDepth--;
  }
}

for (const table of [db.entries, db.reflections, db.portraits]) {
  table.hook("creating", () => {
    emitChange();
  });
  table.hook("updating", () => {
    emitChange();
  });
  table.hook("deleting", () => {
    emitChange();
  });
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  await db.entries.put(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

/** Most-recent-first list of entries. */
export async function listEntries(): Promise<JournalEntry[]> {
  return db.entries.orderBy("createdAt").reverse().toArray();
}

/** Compact context from the last `n` entries, for stateless server-side AI calls. */
export async function recentContext(n = 6): Promise<EntryContext[]> {
  const entries = await db.entries
    .orderBy("createdAt")
    .reverse()
    .limit(n)
    .toArray();
  return entries.map((e) => ({
    title: e.title,
    summary: e.summary,
    themes: e.themes,
    mood: e.mood,
    createdAt: e.createdAt,
  }));
}

export async function saveReflection(reflection: Reflection): Promise<void> {
  await db.reflections.put(reflection);
}

/** The most recent saved reflection, or undefined if none yet. */
export async function latestReflection(): Promise<Reflection | undefined> {
  return db.reflections.orderBy("createdAt").reverse().first();
}

/** Self-portraits, oldest-first — the order the timelapse plays through. */
export async function listPortraits(): Promise<Portrait[]> {
  return db.portraits.orderBy("capturedAt").toArray();
}

export async function savePortrait(portrait: Portrait): Promise<void> {
  await db.portraits.put(portrait);
}

export async function deletePortrait(id: string): Promise<void> {
  await db.portraits.delete(id);
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
