"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { db, saveReflection, latestReflection } from "@/lib/db";
import { toRef } from "@/lib/retrieve";
import { estimateCost, formatCost, formatDate, modelLabel } from "@/lib/format";
import { logAi } from "@/lib/usage";
import type { SynthesisResponse } from "@/lib/types";

/**
 * "Where you are" — the AI's gentle read across recent entries. Lives at the
 * top of Ask (moved from the retired Themes tab); the latest reflection is
 * kept locally and shown until you ask for a fresh one.
 */
export default function ReflectCard() {
  const count = useLiveQuery(() => db.entries.count());
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
      if (data.usage) void logAi({ feature: "reflect", model: data.model, usage: data.usage });
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
    <div className="rounded-2xl border border-lavender/30 bg-gradient-to-br from-lavender/10 to-terracotta/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-ink">Where you are</h2>
        <button
          type="button"
          onClick={reflect}
          disabled={loading || !count}
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
                <li
                  key={t}
                  className="rounded-full bg-terracotta/12 px-3 py-1 text-xs font-medium text-terracotta"
                >
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
