"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { db, getSetting } from "@/lib/db";
import EntryCard from "@/components/EntryCard";
import JournalPage from "@/components/JournalPage";
import ThemeFilter, { matchesFilter, type FilterValue } from "@/components/ThemeFilter";
import ViewToggle from "@/components/ViewToggle";
import BookView from "@/components/BookView";
import Bookshelf from "@/components/Bookshelf";
import PageBar from "@/components/PageBar";
import { DemoBanner, SeedButton } from "@/components/DemoControls";
import { greeting } from "@/lib/format";
import { readView, saveView, type ViewMode } from "@/lib/views";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { maya } from "@/lib/maya";
import { emptyLine } from "@/lib/mayaLines";

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
  const [view, setViewState] = useState<ViewMode>("scroll");
  const desktop = useIsDesktop();

  useEffect(() => setViewState(readView("timeline")), []);

  // A blank journal is the one place she speaks unprompted, whatever her
  // frequency — the empty page is exactly when a nudge helps.
  const blank = entries?.length === 0;
  useEffect(() => {
    if (!blank) return;
    const t = window.setTimeout(() => maya.say(emptyLine(), "empty", 9000), 2200);
    return () => window.clearTimeout(t);
  }, [blank]);
  function setView(v: ViewMode) {
    setViewState(v);
    saveView("timeline", v);
  }

  const shown = entries?.filter((e) => matchesFilter(e, filter)) ?? [];

  const heading = (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="truncate font-serif text-lg text-ink lg:text-xl"
    >
      {greeting()}
      {name ? `, ${name}` : ""}.
    </motion.p>
  );

  if (entries === undefined) {
    return (
      <div>
        <PageBar heading={heading} />
        <div className="mx-auto max-w-2xl lg:mx-0">
          <LoadingShimmer />
        </div>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div>
        <PageBar heading={heading} />
        <div className="mx-auto max-w-2xl">
          <EmptyState />
        </div>
      </div>
    );
  }

  const controls = (
    <>
      <ThemeFilter
        entries={entries}
        value={filter}
        onChange={setFilter}
        trailing={<ViewToggle value={view} onChange={setView} />}
      />
    </>
  );

  const reading =
    shown.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-hairline bg-surface/40 p-8 text-center text-muted">
        No entries match that filter.
      </p>
    ) : view === "book" ? (
      // On a laptop the book becomes a shelf you pick from; on a phone it
      // stays a single volume you flip straight through.
      desktop ? (
        <Bookshelf entries={shown} />
      ) : (
        <BookView
          items={shown}
          keyOf={(e) => e.id}
          paginate
          renderPage={(entry) => <JournalPage entry={entry} />}
        />
      )
    ) : (
      <div className="space-y-5">
        <AnimatePresence initial={false}>
          {shown.map((entry, i) => (
            <EntryCard key={entry.id} entry={entry} index={i} />
          ))}
        </AnimatePresence>
      </div>
    );

  // Greeting, controls and tabs share one line across the top; the journal
  // itself then has the full width — stacked cards, or the shelf.
  return (
    <div>
      <PageBar heading={heading} controls={controls} />
      <DemoBanner />
      {reading}
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
