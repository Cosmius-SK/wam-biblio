"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import VoiceRecorder from "./VoiceRecorder";
import { recentContext, saveEntry } from "@/lib/db";
import type { JournalEntry, StructureResponse } from "@/lib/types";
import { estimateCost, formatCost, modelLabel } from "@/lib/format";

type Phase = "compose" | "shaping" | "review";

export default function CaptureComposer() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("compose");
  const [text, setText] = useState("");
  const [significant, setSignificant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StructureResponse | null>(null);

  // For the review screen, editable copies of what Claude produced.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const baseTextRef = useRef("");
  const usedVoiceRef = useRef(false);

  async function shape() {
    if (!text.trim()) return;
    setError(null);
    setPhase("shaping");
    try {
      const recent = await recentContext();
      const res = await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: text.trim(),
          source: usedVoiceRef.current ? "voice" : "text",
          recent,
          markedSignificant: significant,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Something went wrong (${res.status}).`);
      }
      const data = (await res.json()) as StructureResponse;
      setResult(data);
      setTitle(data.entry.title);
      setBody(data.entry.body);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not shape the entry.");
      setPhase("compose");
    }
  }

  async function accept() {
    if (!result) return;
    const entry: JournalEntry = {
      ...result.entry,
      title: title.trim() || result.entry.title,
      body: body.trim() || result.entry.body,
      id: crypto.randomUUID(),
      raw: text.trim(),
      createdAt: Date.now(),
      model: result.model,
      source: usedVoiceRef.current ? "voice" : "text",
      significant: significant || result.entry.significant,
    };
    await saveEntry(entry);
    router.push("/");
  }

  function discard() {
    setResult(null);
    setPhase("compose");
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "compose" && (
        <motion.div
          key="compose"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-serif text-3xl text-ink">What&rsquo;s on your mind?</h1>
          <p className="mt-1 text-muted">Speak or type. Don&rsquo;t worry how it comes out.</p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            autoFocus
            placeholder="A thought, a feeling, a fragment…"
            className="mt-5 w-full resize-none rounded-2xl border border-hairline bg-surface/70 p-5 font-serif text-lg leading-relaxed text-ink shadow-soft placeholder:text-muted/60 focus:border-lavender/60"
          />

          <div className="mt-4">
            <VoiceRecorder
              onStart={() => {
                baseTextRef.current = text;
                usedVoiceRef.current = true;
              }}
              onTranscript={(spoken) =>
                setText((baseTextRef.current ? baseTextRef.current + " " : "") + spoken)
              }
              onError={(msg) =>
                setError(
                  msg === "not-allowed"
                    ? "Microphone permission was blocked."
                    : "Voice capture stopped.",
                )
              }
            />
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={significant}
              onChange={(e) => setSignificant(e.target.checked)}
              className="h-4 w-4 accent-terracotta"
            />
            This moment matters — give it the deeper touch
          </label>

          {error && (
            <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={shape}
            disabled={!text.trim()}
            className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            Shape this into an entry
          </button>
        </motion.div>
      )}

      {phase === "shaping" && (
        <motion.div
          key="shaping"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex min-h-[50vh] flex-col items-center justify-center text-center"
        >
          <div className="h-16 w-16 animate-breathe rounded-full bg-gradient-to-br from-terracotta/50 via-lavender/50 to-sage/50" />
          <p className="mt-6 font-serif text-xl text-ink">Listening to what you meant…</p>
          <p className="mt-1 text-sm text-muted">Shaping it into something whole.</p>
        </motion.div>
      )}

      {phase === "review" && result && (
        <motion.div
          key="review"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-sm text-muted">Here&rsquo;s how it came back. Edit anything, then keep it.</p>

          <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/70 p-6 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted">
              <span className="italic text-lavender">{result.entry.mood}</span>
              {result.entry.significant && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-terracotta">a significant moment</span>
                </>
              )}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent font-serif text-2xl text-ink focus:outline-none"
              aria-label="Entry title"
            />

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              aria-label="Entry text"
              className="mt-3 w-full resize-none bg-transparent font-serif text-[1.05rem] leading-relaxed text-ink/90 focus:outline-none"
            />

            {result.entry.themes.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {result.entry.themes.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-sage/15 px-3 py-1 text-xs font-medium text-sage"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-muted/80">
            shaped by {modelLabel(result.model)}
            {result.usage
              ? ` · ${formatCost(
                  estimateCost(result.model, result.usage.inputTokens, result.usage.outputTokens),
                )}`
              : ""}
          </p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={discard}
              className="flex-1 rounded-full border border-hairline bg-surface/60 px-6 py-3 font-medium text-ink transition-transform hover:scale-[1.02] active:scale-95"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={accept}
              className="flex-1 rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform hover:scale-[1.02] active:scale-95"
            >
              Keep it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
