"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import VoiceRecorder from "./VoiceRecorder";
import WhenWhere, { nowForInput } from "./WhenWhere";
import PhotoAttach from "./PhotoAttach";
import { recentContext, saveEntry } from "@/lib/db";
import type {
  EntryPhoto,
  EntryPlace,
  JournalEntry,
  StructuredEntry,
  StructureResponse,
} from "@/lib/types";
import { estimateCost, formatCost, formatDate, modelLabel } from "@/lib/format";
import { placeLabel } from "@/lib/geo";
import { uploadPhotos, type PendingPhoto } from "@/lib/media";
import { logAi } from "@/lib/usage";
import { generateIllustration } from "@/lib/illustrate";
import { AI_MODE_COOKIE } from "@/lib/ai/constants";

type Phase = "compose" | "shaping" | "review";

/** The chosen "when", as epoch ms — falling back to now if the input is empty/invalid. */
function whenToMs(when: string): number {
  const ms = new Date(when).getTime();
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

/** A short title from the first words, for entries saved without AI. */
function deriveTitle(text: string): string {
  const first = text.trim().replace(/\s+/g, " ").split(/[.!?\n]/)[0] || text;
  const words = first.split(" ").slice(0, 6).join(" ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Untitled";
}

/** Whether this device is in Live AI mode (illustrations need it). */
function aiIsLive(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.cookie.match(new RegExp(`(?:^|; )${AI_MODE_COOKIE}=([^;]*)`));
  return !!m && decodeURIComponent(m[1]) === "live";
}

export default function CaptureComposer() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("compose");
  const [text, setText] = useState("");
  const [significant, setSignificant] = useState(false);
  const [illustrate, setIllustrate] = useState(false);
  const [live, setLive] = useState(false);
  const [when, setWhen] = useState<string>(() => nowForInput());
  const [place, setPlace] = useState<EntryPlace | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StructureResponse | null>(null);

  // For the review screen, editable copies of what Claude produced.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const baseTextRef = useRef("");
  const usedVoiceRef = useRef(false);

  useEffect(() => setLive(aiIsLive()), []);

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
          occurredAt: new Date(whenToMs(when)).toDateString(),
          placeName: place ? placeLabel(place) : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Something went wrong (${res.status}).`);
      }
      const data = (await res.json()) as StructureResponse;
      if (data.usage) void logAi({ feature: "shape", model: data.model, usage: data.usage });
      setResult(data);
      setTitle(data.entry.title);
      setBody(data.entry.body);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not shape the entry.");
      setPhase("compose");
    }
  }

  /** Upload any photos, build the entry, persist it, and go to the timeline. */
  async function commit(structured: StructuredEntry, model: string) {
    setError(null);
    let entryPhotos: EntryPhoto[] | undefined;
    if (photos.length > 0) {
      try {
        setSaveProgress(`Securing photo 1 of ${photos.length}…`);
        entryPhotos = await uploadPhotos(photos, (done, total) => {
          setSaveProgress(done < total ? `Securing photo ${done + 1} of ${total}…` : "Keeping…");
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload the photos.");
        setSaveProgress(null);
        return;
      }
    }
    const entry: JournalEntry = {
      ...structured,
      id: crypto.randomUUID(),
      raw: text.trim(),
      createdAt: whenToMs(when),
      recordedAt: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      place: place ?? undefined,
      photos: entryPhotos,
      model,
      source: usedVoiceRef.current ? "voice" : "text",
      significant: structured.significant,
    };
    await saveEntry(entry);
    // Illustration is drawn AFTER saving, in the background — the entry appears
    // on the timeline immediately and the card updates live when the art lands.
    if (illustrate && live) void illustrateInBackground(entry);
    router.push("/");
  }

  async function illustrateInBackground(entry: JournalEntry) {
    try {
      const prompt =
        entry.imagePrompt?.trim() || `a calm, simple scene evoking a ${entry.mood} mood`;
      const image = await generateIllustration(prompt);
      await saveEntry({ ...entry, image });
    } catch {
      // Quiet by design — the card's ⋯ menu offers Illustrate with the full
      // error dialog whenever the writer wants to retry.
    }
  }

  async function accept() {
    if (!result) return;
    await commit(
      {
        ...result.entry,
        title: title.trim() || result.entry.title,
        body: body.trim() || result.entry.body,
        significant: significant || result.entry.significant,
      },
      result.model,
    );
  }

  /** Save exactly what was typed — no AI shaping, no spend. */
  async function saveDirect() {
    const t = text.trim();
    if (!t) return;
    await commit(
      {
        title: deriveTitle(t),
        body: t,
        summary: t.replace(/\s+/g, " ").slice(0, 140),
        themes: [],
        mood: "neutral",
        entities: [],
        significant,
        imagePrompt: "A soft, calm scene in warm dusk light.",
      },
      "self",
    );
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

          <WhenWhere when={when} onWhenChange={setWhen} place={place} onPlaceChange={setPlace} />

          <PhotoAttach photos={photos} onChange={setPhotos} />

          <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={significant}
              onChange={(e) => setSignificant(e.target.checked)}
              className="h-4 w-4 accent-terracotta"
            />
            This moment matters — give it the deeper touch
          </label>

          <label
            className={`mt-3 flex items-center gap-3 text-sm ${
              live ? "cursor-pointer text-muted" : "cursor-not-allowed text-muted/50"
            }`}
          >
            <input
              type="checkbox"
              checked={illustrate}
              disabled={!live}
              onChange={(e) => setIllustrate(e.target.checked)}
              className="h-4 w-4 accent-lavender"
            />
            Draw an illustration for this entry
            {!live && <span className="text-xs">(needs Live AI — see Settings › AI)</span>}
          </label>

          {error && (
            <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={shape}
            disabled={!text.trim() || saveProgress !== null}
            className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            Shape this into an entry
          </button>
          <button
            type="button"
            onClick={saveDirect}
            disabled={!text.trim() || saveProgress !== null}
            className="mt-3 w-full rounded-full border border-hairline bg-surface/60 px-6 py-3 font-medium text-ink transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            {saveProgress ?? "Save"}
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
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              {place && (
                <>
                  <span>📍 {placeLabel(place)}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{formatDate(whenToMs(when))}</span>
              <span aria-hidden>·</span>
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

            {photos.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {photos.map((p) => (
                  <li key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                    <img
                      src={p.thumb}
                      alt=""
                      className="h-16 w-16 rounded-xl border border-hairline/60 object-cover"
                    />
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

          {error && (
            <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={discard}
              disabled={saveProgress !== null}
              className="flex-1 rounded-full border border-hairline bg-surface/60 px-6 py-3 font-medium text-ink transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={saveProgress !== null}
              className="flex-1 rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
            >
              {saveProgress ?? "Keep it"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
