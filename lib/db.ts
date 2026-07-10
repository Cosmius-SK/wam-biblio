"use client";

import Dexie, { type Table } from "dexie";
import type { JournalEntry, EntryContext, Reflection } from "./types";

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

class JournalDB extends Dexie {
  entries!: Table<JournalEntry, string>;
  reflections!: Table<Reflection, string>;
  settings!: Table<Setting, string>;

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
  }
}

export const db = new JournalDB();

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

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
