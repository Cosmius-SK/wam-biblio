import type { JournalEntry } from "./types";

/**
 * Pure, on-device organization of the journal — the "self-organizing library".
 * Groups entries by theme, finds connections between them, and summarizes mood,
 * all from the metadata Claude already extracted at capture time. No model call
 * and no data leaves the device.
 */

export interface ThemeCluster {
  theme: string;
  entries: JournalEntry[];
}

/** Themes ordered by how much of the journal they run through. */
export function groupByTheme(entries: JournalEntry[]): ThemeCluster[] {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    for (const theme of e.themes) {
      const key = theme.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
  }
  return [...map.entries()]
    .map(([theme, list]) => ({
      theme,
      entries: list.sort((a, b) => b.createdAt - a.createdAt),
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.theme.localeCompare(b.theme));
}

/** Entries connected to `entry` by shared themes/entities (a "thread"). */
export function relatedTo(entry: JournalEntry, all: JournalEntry[], max = 3): JournalEntry[] {
  const themes = new Set(entry.themes.map((t) => t.toLowerCase()));
  const entities = new Set(entry.entities.map((t) => t.toLowerCase()));

  return all
    .filter((e) => e.id !== entry.id)
    .map((e) => {
      let s = 0;
      for (const t of e.themes) if (themes.has(t.toLowerCase())) s += 2;
      for (const en of e.entities) if (entities.has(en.toLowerCase())) s += 1;
      return { e, s };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || b.e.createdAt - a.e.createdAt)
    .slice(0, max)
    .map((r) => r.e);
}

export interface MoodCount {
  mood: string;
  count: number;
}

/** Mood distribution across the journal, most common first. */
export function moodDistribution(entries: JournalEntry[]): MoodCount[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = e.mood.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count);
}
