"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { db, getSetting } from "@/lib/db";
import EntryCard from "@/components/EntryCard";
import ThemeFilter, { matchesFilter, type FilterValue } from "@/components/ThemeFilter";
import { DemoBanner, SeedButton } from "@/components/DemoControls";
import { greeting } from "@/lib/format";

/**
 * The living timeline — the journal as a continuous, self-arranging canvas.
 * Reads entries live from the local-first store (IndexedDB) so new entries
 * appear the moment they are accepted, online or offline.
 */
export default function TimelinePage() {
  // `undefined` while loading; an array once IndexedDB has answered.
  const entries = useLiveQuery(() => db.entries.orderBy("createdAt").reverse().toArray());
  const name = useLiveQuery(() => getSetting("displayName"));
  const [filter, setFilter] = useState<FilterValue | null>(null);

  const shown = entries?.filter((e) => matchesFilter(e, filter));

  return (
    <div>
      <div className="mb-8 mt-4">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-serif text-3xl text-ink"
        >
          {greeting()}
          {name ? `, ${name}` : ""}.
        </motion.h1>
        <p className="mt-1 text-muted">
          {entries && entries.length > 0
            ? "Your story so far."
            : "A quiet place for whatever is on your mind."}
        </p>
      </div>

      {entries === undefined ? (
        <LoadingShimmer />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <DemoBanner />
          <ThemeFilter entries={entries} value={filter} onChange={setFilter} />
          {shown && shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-hairline bg-surface/40 p-8 text-center text-muted">
              No entries match that filter.
            </p>
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {shown?.map((entry, i) => (
                  <EntryCard key={entry.id} entry={entry} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="rounded-2xl border border-dashed border-hairline bg-surface/40 p-10 text-center"
    >
      <div className="mx-auto mb-5 h-14 w-14 animate-breathe rounded-full bg-gradient-to-br from-terracotta/40 via-lavender/40 to-sage/40" />
      <p className="font-serif text-xl text-ink">Nothing written yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        Say or type a single thought — however messy. It&rsquo;ll come back to you as
        something whole.
      </p>
      <div className="mt-6 flex flex-col items-center gap-1">
        <Link
          href="/capture"
          className="inline-block rounded-full bg-ink/90 px-5 py-2 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.03] active:scale-95"
        >
          Begin
        </Link>
        <SeedButton />
      </div>
    </motion.div>
  );
}

function LoadingShimmer() {
  return (
    <div className="space-y-5">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-2xl border border-hairline/60 bg-surface/50"
        />
      ))}
    </div>
  );
}
