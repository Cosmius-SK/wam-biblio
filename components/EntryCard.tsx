"use client";

import { motion } from "framer-motion";
import type { JournalEntry } from "@/lib/types";
import { formatDate, formatTime, modelLabel } from "@/lib/format";

/** A single entry in the living timeline — reading-first, book-like. */
export default function EntryCard({
  entry,
  index = 0,
}: {
  entry: JournalEntry;
  index?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="group relative rounded-2xl border border-hairline/70 bg-surface/70 p-6 shadow-soft backdrop-blur-sm"
    >
      {entry.significant && (
        <span
          aria-hidden
          className="absolute left-0 top-6 h-8 w-1 rounded-r-full bg-terracotta/80"
          title="A significant moment"
        />
      )}

      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <time dateTime={new Date(entry.createdAt).toISOString()}>
          {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
        </time>
        <span aria-hidden>·</span>
        <span className="italic text-lavender">{entry.mood}</span>
      </div>

      <h2 className="font-serif text-2xl leading-snug text-ink">{entry.title}</h2>

      <p className="mt-3 whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-ink/90">
        {entry.body}
      </p>

      {entry.themes.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {entry.themes.map((theme) => (
            <li
              key={theme}
              className="rounded-full bg-sage/15 px-3 py-1 text-xs font-medium text-sage"
            >
              {theme}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-[0.7rem] uppercase tracking-wide text-muted/70">
        shaped by {modelLabel(entry.model)}
        {entry.source === "voice" ? " · spoken" : ""}
      </div>
    </motion.article>
  );
}
