"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { db, saveReflection, latestReflection } from "@/lib/db";
import { groupByTheme, moodDistribution } from "@/lib/organize";
import { toRef } from "@/lib/retrieve";
import { estimateCost, formatCost, formatDate, modelLabel } from "@/lib/format";
import type { JournalEntry, SynthesisResponse } from "@/lib/types";
import EntryCard from "./EntryCard";

export default function ThemesView() {
  const entries = useLiveQuery(() => db.entries.orderBy("createdAt").reverse().toArray());
  const [selected, setSelected] = useState<string | null>(null);

  if (entries === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl border border-hairline/60 bg-surface/50" />;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface/40 p-10 text-center">
        <p className="font-serif text-xl text-ink">Nothing to connect yet.</p>
        <p className="mt-2 text-muted">Your themes and threads appear here as you write.</p>
        <Link
          href="/capture"
          className="mt-5 inline-block rounded-full bg-ink/90 px-5 py-2 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.03] active:scale-95"
        >
          Begin
        </Link>
      </div>
    );
  }

  const clusters = groupByTheme(entries);
  const moods = moodDistribution(entries);
  const shown = selected ? entries.filter((e) => e.themes.some((t) => t.toLowerCase() === selected)) : [];

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">The shape of it</h1>
      <p className="mt-1 text-muted">How your entries gather, and where you are right now.</p>

      <ReflectCard entries={entries} />

      {moods.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-muted/70">Moods</h2>
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <span
                key={m.mood}
                className="rounded-full bg-lavender/12 px-3 py-1 text-sm text-lavender"
              >
                {m.mood} <span className="text-lavender/60">· {m.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-muted/70">Themes</h2>
        <div className="flex flex-wrap gap-2">
          {clusters.map((c) => {
            const active = selected === c.theme;
            return (
              <button
                key={c.theme}
                type="button"
                onClick={() => setSelected(active ? null : c.theme)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-sage text-paper" : "bg-sage/15 text-sage hover:bg-sage/25"
                }`}
              >
                {c.theme} <span className="opacity-60">· {c.entries.length}</span>
              </button>
            );
          })}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 space-y-5"
          >
            <p className="text-sm text-muted">
              {shown.length} {shown.length === 1 ? "entry" : "entries"} under{" "}
              <span className="text-sage">{selected}</span>
            </p>
            {shown.map((e, i) => (
              <EntryCard key={e.id} entry={e} index={i} />
            ))}
          </motion.div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted/70">Tap a theme to follow its thread.</p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReflectCard({ entries }: { entries: JournalEntry[] }) {
  const saved = useLiveQuery(latestReflection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ model: string; cost: number } | null>(null);

  async function reflect() {
    setError(null);
    setLoading(true);
    try {
      const refs = await db.entries.orderBy("createdAt").reverse().limit(14).toArray();
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: refs.map(toRef) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Something went wrong (${res.status}).`);
      }
      const data = (await res.json()) as SynthesisResponse;
      await saveReflection({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        title: data.title,
        reflection: data.reflection,
        themes: data.themes,
      });
      if (data.usage) {
        setUsage({
          model: data.model,
          cost: estimateCost(data.model, data.usage.inputTokens, data.usage.outputTokens),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reflect just now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-lavender/30 bg-gradient-to-br from-lavender/10 to-terracotta/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-ink">Where you are</h2>
        <button
          type="button"
          onClick={reflect}
          disabled={loading || entries.length === 0}
          className="shrink-0 rounded-full bg-ink/90 px-4 py-1.5 text-sm font-medium text-paper transition-transform enabled:hover:scale-[1.03] enabled:active:scale-95 disabled:opacity-40"
        >
          {loading ? "Reflecting…" : saved ? "Reflect again" : "Reflect on where I am"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-muted">
          <span className="h-8 w-8 animate-breathe rounded-full bg-gradient-to-br from-lavender/50 to-terracotta/50" />
          Looking across your recent entries…
        </div>
      )}

      {saved && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <h3 className="font-serif text-xl text-ink">{saved.title}</h3>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-ink/90">
            {saved.reflection}
          </p>
          {saved.themes.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {saved.themes.map((t) => (
                <li key={t} className="rounded-full bg-terracotta/12 px-3 py-1 text-xs font-medium text-terracotta">
                  {t}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted/70">
            {formatDate(saved.createdAt)}
            {usage ? ` · ${modelLabel(usage.model)} · ${formatCost(usage.cost)}` : ""}
          </p>
        </motion.div>
      )}

      {!saved && !loading && !error && (
        <p className="mt-3 text-sm text-muted">
          A gentle read on the threads running through your recent entries.
        </p>
      )}
    </div>
  );
}
