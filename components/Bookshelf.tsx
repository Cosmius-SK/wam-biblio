"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { JournalEntry } from "@/lib/types";
import { resolveHeader } from "@/lib/entryHeader";
import { formatDate } from "@/lib/format";
import SceneImage from "./SceneImage";
import BookView from "./BookView";
import JournalPage from "./JournalPage";

/**
 * Book mode with room to breathe (laptop and up): the journal as a shelf,
 * every entry a slim volume standing on its cover. Pick one up and it opens
 * into the paginated reader; close it and you are back at the shelf.
 */
export default function Bookshelf({ entries }: { entries: JournalEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId);

  if (open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to the shelf
        </button>
        <BookView
          items={[open]}
          keyOf={(e) => e.id}
          paginate
          renderPage={(entry) => <JournalPage entry={entry} />}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-7 xl:grid-cols-4">
      {entries.map((entry, i) => {
        const hero = resolveHeader(entry);
        return (
          <motion.button
            key={entry.id}
            type="button"
            onClick={() => setOpenId(entry.id)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.4), ease: "easeOut" }}
            whileHover={{ y: -6, rotate: -0.4 }}
            className="paper-surface group relative aspect-[3/4] overflow-hidden rounded-l-sm rounded-r-xl bg-surface text-left shadow-page"
          >
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data-URL image
              <img
                src={hero.kind === "photo" ? hero.photo.thumb : hero.src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <SceneImage entry={entry} className="absolute inset-0 h-full w-full object-cover" />
            )}

            {/* The spine, and enough shade under the title to read it. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
            />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            />

            <span className="absolute inset-x-0 bottom-0 block p-4 pl-6">
              <span className="block font-serif text-lg leading-snug text-white drop-shadow">
                {entry.title}
              </span>
              <span className="mt-1 block text-xs text-white/75">
                {formatDate(entry.createdAt, entry.timezone)} · {entry.mood}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
