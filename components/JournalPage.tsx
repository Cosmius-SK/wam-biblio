"use client";

import type { JournalEntry } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/format";
import { resolveHeader } from "@/lib/entryHeader";

/**
 * One entry as printed-journal content: date line, title, the chosen art,
 * the words, mood at the end. Pure flowing markup — BookView paginates it
 * across as many leaves as it needs (page padding lives there too), so
 * nothing here may pin itself to a page edge.
 */
export default function JournalPage({ entry }: { entry: JournalEntry }) {
  const hero = resolveHeader(entry);
  const art = hero ? (hero.kind === "photo" ? hero.photo.thumb : hero.src) : undefined;
  return (
    <article>
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {formatDate(entry.createdAt, entry.timezone)} ·{" "}
        {formatTime(entry.createdAt, entry.timezone)}
        {entry.place ? ` · ${entry.place.name}` : ""}
      </p>

      <h2 className="mt-2 font-serif text-2xl leading-snug text-ink">{entry.title}</h2>

      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- local data-URL image
        <img src={art} alt="" className="mt-4 h-40 w-full rounded-md object-cover" />
      )}

      <p className="mt-4 whitespace-pre-wrap font-serif text-[1.02rem] leading-relaxed text-ink/90">
        {entry.body}
      </p>

      <footer className="mt-6 pb-2">
        <p className="text-xs italic text-lavender">{entry.mood}</p>
        {entry.themes.length > 0 && (
          <p className="mt-1 text-xs text-sage">{entry.themes.join(" · ")}</p>
        )}
      </footer>
    </article>
  );
}
