"use client";

import Dexie, { type Table } from "dexie";
import type { JournalEntry, EntryContext } from "./types";

/**
 * Local-first store. Entries live in the browser (IndexedDB) and are the
 * source of truth — capture works offline, and nothing leaves the device
 * except the AI calls the user explicitly triggers. Encrypted cloud sync is
 * a later phase (see plan, Phase 4).
 */
class JournalDB extends Dexie {
  entries!: Table<JournalEntry, string>;

  constructor() {
    super("wam-biblio");
    this.version(1).stores({
      // Indexed fields; `themes` is multi-entry for theme/thread views (Phase 2).
      entries: "id, createdAt, mood, *themes",
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
