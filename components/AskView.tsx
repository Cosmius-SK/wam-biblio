"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/db";
import { retrieve, toRef } from "@/lib/retrieve";
import { estimateCost, formatCost, modelLabel } from "@/lib/format";
import { logAi } from "@/lib/usage";
import type { AskResponse } from "@/lib/types";

const SUGGESTIONS = [
  "What's been on my mind lately?",
  "When do I seem happiest?",
  "What keeps coming up for me?",
  "What have I been worried about?",
];

export default function AskView() {
  const entries = useLiveQuery(() => db.entries.toArray());
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    (entries ?? []).forEach((e) => m.set(e.id, e.title));
    return m;
  }, [entries]);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || !entries || entries.length === 0) return;
    setError(null);
    setLoading(true);
    setAsked(query);
    setResult(null);
    try {
      const top = retrieve(query, entries).map(toRef);
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, entries: top }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
        throw new Error(
          [data.error || `Something went wrong (${res.status}).`, data.hint]
            .filter(Boolean)
            .join(" "),
        );
      }
      const data = (await res.json()) as AskResponse;
      if (data.usage) void logAi({ feature: "ask", model: data.model, usage: data.usage });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't answer that.");
    } finally {
      setLoading(false);
    }
  }

  const hasEntries = entries && entries.length > 0;

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Ask your journal</h1>
      <p className="mt-1 text-muted">
        Ask anything about what you&rsquo;ve written. Answers come only from your own entries.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mt-5"
      >
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface/70 p-1.5 pl-5 shadow-soft focus-within:border-lavender/60">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={hasEntries ? "What would you like to understand?" : "No entries yet…"}
            disabled={!hasEntries}
            className="flex-1 bg-transparent py-2 text-ink placeholder:text-muted/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!hasEntries || loading || !question.trim()}
            className="shrink-0 rounded-full bg-ink/90 px-5 py-2 text-sm font-medium text-paper transition-transform enabled:hover:scale-[1.03] enabled:active:scale-95 disabled:opacity-40"
          >
            {loading ? "Reading…" : "Ask"}
          </button>
        </div>
      </form>

      {hasEntries && !result && !loading && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                ask(s);
              }}
              className="rounded-full border border-hairline bg-surface/50 px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {!hasEntries && (
        <p className="mt-6 rounded-2xl border border-dashed border-hairline bg-surface/40 p-6 text-center text-muted">
          Once you&rsquo;ve written a few entries, you can ask your journal about them.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</p>
      )}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 flex flex-col items-center"
          >
            <div className="h-12 w-12 animate-breathe rounded-full bg-gradient-to-br from-lavender/50 via-sage/50 to-terracotta/50" />
            <p className="mt-4 text-sm text-muted">Reading back through your entries…</p>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-7"
          >
            {asked && <p className="mb-3 font-serif text-lg italic text-muted">&ldquo;{asked}&rdquo;</p>}
            <div className="rounded-2xl border border-hairline/70 bg-surface/70 p-6 shadow-soft">
              <p className="whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-ink/90">
                {result.answer}
              </p>

              {result.citations.length > 0 && (
                <div className="mt-5 border-t border-hairline/60 pt-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted/70">From your entries</p>
                  <ul className="flex flex-wrap gap-2">
                    {result.citations.map((id) => (
                      <li
                        key={id}
                        className="rounded-full bg-lavender/15 px-3 py-1 text-xs font-medium text-lavender"
                      >
                        {titleById.get(id) ?? "an entry"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-muted/80">
              answered by {modelLabel(result.model)}
              {result.usage
                ? ` · ${formatCost(
                    estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
                  )}`
                : ""}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
