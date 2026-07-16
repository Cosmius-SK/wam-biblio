"use client";

import type { JournalEntry } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/format";
import { resolveHeader } from "@/lib/entryHeader";

/**
 * One page of the book: a quiet, printed-journal layout — date line, title,
 * a single photograph (or the entry's illustration), the words, and mood at
 * the foot. Deliberately static: the page turn is the only motion, and every
 * page shares the same paper frame (BookView owns the frame). Reading mode —
 * editing lives in the timeline view.
 */
export default function JournalPage({ entry }: { entry: JournalEntry }) {
  const hero = resolveHeader(entry);
  const art = hero ? (hero.kind === "photo" ? hero.photo.thumb : hero.src) : undefined;
  return (
    <article className="flex min-h-full flex-col px-7 py-7 pl-10">
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {formatDate(entry.createdAt, entry.timezone)} ·{" "}
        {formatTime(entry.createdAt, entry.timezone)}
        {entry.place ? ` · ${entry.place.name}` : ""}
      </p>

      <h2 className="mt-2 font-serif text-2xl leading-snug text-ink">{entry.title}</h2>

      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- local data-URL image
        <img src={art} alt="" className="mt-4 h-40 w-full shrink-0 rounded-md object-cover" />
      )}

      <p className="mt-4 whitespace-pre-wrap font-serif text-[1.02rem] leading-relaxed text-ink/90">
        {entry.body}
      </p>

      <footer className="mt-auto pt-6">
        <p className="text-xs italic text-lavender">{entry.mood}</p>
        {entry.themes.length > 0 && (
          <p className="mt-1 text-xs text-sage">{entry.themes.join(" · ")}</p>
        )}
      </footer>
    </article>
  );
}
