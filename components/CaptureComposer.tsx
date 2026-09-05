"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import VoiceRecorder from "./VoiceRecorder";
import WhenWhere, { nowForInput } from "./WhenWhere";
import PhotoAttach from "./PhotoAttach";
import { db, recentContext, saveEntry } from "@/lib/db";
import type {
  Draft,
  EntryPhoto,
  EntryPlace,
  JournalEntry,
  StructuredEntry,
  StructureResponse,
} from "@/lib/types";
import { agoLabel, estimateCost, formatCost, formatDate, modelLabel } from "@/lib/format";
import { placeLabel } from "@/lib/geo";
import {
  STALE_MS,
  clearDraft,
  draftSyncState,
  type DraftSync,
  discardDraft,
  draftFrom,
  flushDraft,
  loadDraft,
  queueDraftSave,
} from "@/lib/drafts";
import { noteEntryWritten } from "@/lib/session";
import { sendToday } from "@/lib/insights/collect";
import { logAi } from "@/lib/usage";
import { maya } from "@/lib/maya";
import MayaOrb from "./MayaOrb";
import { savedLine } from "@/lib/mayaLines";
import { milestoneFor } from "@/lib/mayaObserve";
import { generateIllustration } from "@/lib/illustrate";
import { promptWithCast } from "@/lib/world/cast";
import { tidyDictation } from "@/lib/tidy";
import { AI_MODE_COOKIE } from "@/lib/ai/constants";

type Phase = "compose" | "shaping" | "review";

/** How much the AI touches the words — the capture screen's one big choice. */
type AiTouch = "deep" | "rephrase" | "none";

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
  const [aiMode, setAiMode] = useState<AiTouch>("rephrase");
  const [illustrate, setIllustrate] = useState(false);
  const [live, setLive] = useState(false);
  const [when, setWhen] = useState<string>(() => nowForInput());
  const [place, setPlace] = useState<EntryPlace | null>(null);
  const [photos, setPhotos] = useState<EntryPhoto[]>([]);
  /** When set, these words were carried over rather than typed just now. */
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  /** A draft old enough that restoring it silently would ambush a new thought. */
  const [stale, setStale] = useState<Draft | null>(null);
  /** Whether what's on screen has reached the other devices yet. */
  const [synced, setSynced] = useState<DraftSync>("none");
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StructureResponse | null>(null);

  // For the review screen, editable copies of what Claude produced.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const baseTextRef = useRef("");
  /** Set while the mic is on, so an edit can tell dictation to start over. */
  const voiceRef = useRef<{ reset: () => void } | null>(null);
  const [tidying, setTidying] = useState(false);
  const usedVoiceRef = useRef(false);
  /** Nothing is written back until the stored draft has had its say. */
  const loadedRef = useRef(false);

  useEffect(() => setLive(aiIsLive()), []);

  // Pick up whatever was left behind. Recent drafts simply reappear in the
  // fields — no dialog, nothing to accept. An old one is offered instead, so a
  // fragment from last month never ambushes a new thought.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await loadDraft();
      if (cancelled) {
        loadedRef.current = true;
        return;
      }
      if (d && Date.now() - d.updatedAt > STALE_MS) {
        setStale(d);
      } else if (d) {
        restore(d);
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function restore(d: Draft) {
    setText(d.text);
    setAiMode(d.aiMode);
    setIllustrate(d.illustrate);
    setWhen(d.when);
    setPlace(d.place ?? null);
    setPhotos(d.photos);
    setResumedAt(d.updatedAt);
    setStale(null);
  }

  // Save at typing speed, locally. The push to the cloud happens at the quiet
  // moments instead (see lib/drafts.ts) — words must survive a dropped phone,
  // not a dropped connection.
  useEffect(() => {
    if (!loadedRef.current) return;
    queueDraftSave(draftFrom(text, aiMode, illustrate, when, place, photos));
  }, [text, aiMode, illustrate, when, place, photos]);

  // Leaving the screen counts as putting it down.
  useEffect(() => () => void flushDraft(true), []);

  // Sync is silent, which is right until it isn't working — so say plainly
  // whether these words have travelled yet.
  useEffect(() => {
    let stop = false;
    const tick = () => void draftSyncState().then((s) => !stop && setSynced(s));
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  async function startFresh() {
    await discardDraft(stale?.photos ?? photos);
    setText("");
    setPhotos([]);
    setPlace(null);
    setWhen(nowForInput());
    setIllustrate(false);
    setResumedAt(null);
    setStale(null);
    setError(null);
  }

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
          markedSignificant: aiMode === "deep",
          shapeMode: aiMode === "none" ? undefined : aiMode,
          occurredAt: new Date(whenToMs(when)).toDateString(),
          placeName: place ? placeLabel(place) : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
        // A refused cap comes with a way forward; showing only the error would
        // turn "it comes back tomorrow" into a bare failure.
        throw new Error(
          [data.error || `Something went wrong (${res.status}).`, data.hint]
            .filter(Boolean)
            .join(" "),
        );
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
    // Photos were encrypted and uploaded the moment they were attached, so
    // keeping an entry is now just a local write.
    const entryPhotos: EntryPhoto[] | undefined = photos.length > 0 ? photos : undefined;
    setSaveProgress("Keeping…");
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
    noteEntryWritten();
    // Report now rather than at the end of the visit. Writing is often the
    // last thing someone does before closing the app, and a count that only
    // leaves on the way out is a count that often doesn't.
    void sendToday();
    // The draft became this entry; its photos belong to the entry now, so only
    // the draft row goes.
    await clearDraft();
    // Maya marks the keeping — a landmark if this one is, otherwise a quiet nod.
    void db.entries.count().then((total) => {
      const landmark = milestoneFor(total);
      maya.say(landmark ?? savedLine(), landmark ? "milestone" : "saved", landmark ? 9000 : 4500);
    });
    // Illustration is drawn AFTER saving, in the background — the entry appears
    // on the timeline immediately and the card updates live when the art lands.
    if (illustrate && live) void illustrateInBackground(entry);
    router.push("/");
  }

  async function illustrateInBackground(entry: JournalEntry) {
    try {
      const prompt =
        entry.imagePrompt?.trim() || `a calm, simple scene evoking a ${entry.mood} mood`;
      const image = await generateIllustration(await promptWithCast(prompt, entry));
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
        significant: aiMode === "deep" || result.entry.significant,
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
        significant: false,
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

          {stale && (
            <div className="mt-5 rounded-2xl border border-hairline/70 bg-surface/60 p-4 shadow-soft">
              <p className="text-sm text-muted">
                You left something unfinished {agoLabel(stale.updatedAt)}.
              </p>
              <p className="mt-2 line-clamp-2 font-serif text-[1.05rem] leading-relaxed text-ink/80">
                {stale.text.trim().slice(0, 160)}
                {stale.text.trim().length > 160 ? "…" : ""}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => restore(stale)}
                  className="rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper transition-transform active:scale-95"
                >
                  Pick it up
                </button>
                <button
                  type="button"
                  onClick={startFresh}
                  className="rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Let it go
                </button>
              </div>
            </div>
          )}

          {(resumedAt !== null || synced !== "none") && (
            <p className="mt-3 text-xs text-muted">
              {resumedAt !== null && <>Picking up where you left off · {agoLabel(resumedAt)}</>}
              {resumedAt !== null && synced !== "none" && " · "}
              {synced === "synced" && "on your other devices"}
              {synced === "pending" && "saved here, still sending"}
              {synced === "offline" && "saved here — will send when you're back online"}
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // The box belongs to whoever is holding it. Dictation rewrites
              // the field from a running transcript, so without this an edit
              // made mid-flow — clearing it and starting again, most of all —
              // was undone by the next word spoken, with the deleted text
              // handed back and the new words stuck on the end.
              if (voiceRef.current) {
                baseTextRef.current = e.target.value;
                voiceRef.current.reset();
              }
            }}
            rows={7}
            autoFocus
            placeholder="A thought, a feeling, a fragment…"
            className="mt-5 w-full resize-none rounded-2xl border border-hairline bg-surface/70 p-5 font-serif text-lg leading-relaxed text-ink shadow-soft placeholder:text-muted/60 focus:border-lavender/60"
          />

          <div className="mt-4">
            {/* Only ever on a tap. It was gated on having used the mic, which
                is held in a ref — not reactive, and reset by any reload — so
                the button could be missing from a box full of dictation. Text
                worth tidying is the only condition that can be seen. */}
            {live && text.trim().length > 20 && (
              <button
                type="button"
                onClick={() => {
                  setTidying(true);
                  setError(null);
                  void tidyDictation(text)
                    .then((tidied) => {
                      setText(tidied);
                      baseTextRef.current = tidied;
                      voiceRef.current?.reset();
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : "Couldn't tidy that."))
                    .finally(() => setTidying(false));
                }}
                disabled={tidying}
                className="mb-3 rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40 disabled:opacity-50"
              >
                {tidying ? "Tidying…" : "Tidy up"}
              </button>
            )}

            <VoiceRecorder
              onStart={() => {
                baseTextRef.current = text;
                usedVoiceRef.current = true;
              }}
              controlRef={voiceRef}
              onTranscript={(spoken) =>
                setText([baseTextRef.current.trim(), spoken.trim()].filter(Boolean).join(" "))
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

          <label className="mt-5 block text-sm text-muted">
            How much should the AI touch this?
            <select
              value={aiMode}
              onChange={(e) => setAiMode(e.target.value as AiTouch)}
              aria-label="AI involvement"
              className="mt-2 w-full cursor-pointer rounded-xl border border-hairline bg-surface/70 px-4 py-3 text-ink shadow-soft focus:border-lavender/60 focus:outline-none"
            >
              <option value="deep">This moment matters — give it the deeper touch</option>
              <option value="rephrase">I&rsquo;ve made most of the point — just rephrase</option>
              <option value="none">No AI — save as is</option>
            </select>
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
            onClick={aiMode === "none" ? saveDirect : shape}
            disabled={!text.trim() || saveProgress !== null}
            className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            {saveProgress ??
              (aiMode === "none"
                ? "Save as is"
                : aiMode === "rephrase"
                  ? "Polish my words"
                  : "Shape this into an entry")}
          </button>

          {(text.trim().length > 0 || photos.length > 0) && (
            <button
              type="button"
              onClick={startFresh}
              className="mx-auto mt-4 block text-xs text-muted underline-offset-2 transition-colors hover:text-terracotta hover:underline"
            >
              Discard this draft
            </button>
          )}
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
          <MayaOrb size={64} state="thinking" />
          <p className="mt-6 font-serif text-xl text-ink">
            {aiMode === "rephrase" ? "Polishing your words…" : "Listening to what you meant…"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {aiMode === "rephrase"
              ? "Your point, your voice — just smoother."
              : "Shaping it into something whole."}
          </p>
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
