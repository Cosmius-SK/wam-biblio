import type { JournalEntry, EntryRef } from "./types";

/**
 * Lightweight, on-device retrieval for "ask your journal". Keeps the journal
 * private — only the entries that actually match a question are sent to the
 * model. (A semantic on-device embedding index can replace this scorer later
 * without changing the call sites.)
 */
const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","of","to","in","on","for","with","as","at","by","from",
  "is","am","are","was","were","be","been","being","do","does","did","have","has","had","i","me","my",
  "you","your","it","its","this","that","these","those","we","they","he","she","what","when","where",
  "who","why","how","about","so","just","really","very","up","down","out","over","again","more","most",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) || []).filter(
    (w) => w.length > 2 && !STOPWORDS.has(w),
  );
}

function entryHaystack(e: JournalEntry): Set<string> {
  return new Set(
    tokenize(`${e.title} ${e.body} ${e.summary} ${e.themes.join(" ")} ${e.entities.join(" ")} ${e.mood}`),
  );
}

function score(queryTokens: string[], e: JournalEntry): number {
  const hay = entryHaystack(e);
  const themeTokens = new Set(tokenize(e.themes.join(" ")));
  let s = 0;
  for (const t of queryTokens) {
    if (themeTokens.has(t)) s += 2; // theme matches weigh more
    else if (hay.has(t)) s += 1;
  }
  return s;
}

/** Top-k entries most relevant to a question; falls back to recency if nothing matches. */
export function retrieve(question: string, entries: JournalEntry[], k = 8): JournalEntry[] {
  const q = tokenize(question);
  const ranked = entries
    .map((e) => ({ e, s: score(q, e) }))
    .sort((a, b) => b.s - a.s || b.e.createdAt - a.e.createdAt);

  const matched = ranked.filter((r) => r.s > 0).slice(0, k).map((r) => r.e);
  if (matched.length > 0) return matched;

  // No keyword overlap — give the model the most recent entries for context.
  return [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, k);
}

/** Project a full entry down to the compact shape AI routes accept. */
export function toRef(e: JournalEntry): EntryRef {
  return {
    id: e.id,
    title: e.title,
    summary: e.summary,
    body: e.body,
    themes: e.themes,
    mood: e.mood,
    createdAt: e.createdAt,
  };
}
