"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { JournalEntry } from "@/lib/types";
import { deleteEntry, saveEntry } from "@/lib/db";
import { formatDate, formatTime, modelLabel, shortZone, zoneDiffers } from "@/lib/format";
import { placeLabel } from "@/lib/geo";
import { generateIllustration, IllustrateError } from "@/lib/illustrate";
import { resolveHeader } from "@/lib/entryHeader";
import SceneImage from "./SceneImage";
import EntryHeader from "./EntryHeader";
import ModelChooser from "./ModelChooser";

/** A single entry in the living timeline — reading-first, book-like. */
export default function EntryCard({
  entry,
  index = 0,
}: {
  entry: JournalEntry;
  index?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [illustrating, setIllustrating] = useState(false);
  const [illustrateError, setIllustrateError] = useState<{ msg: string; hint?: string } | null>(null);

  /** Generate (or replace) the card's illustration on demand. */
  async function illustrate() {
    setIllustrateError(null);
    setIllustrating(true);
    try {
      // Only the sanitized scene prompt leaves the device — never the title/body.
      const scenePrompt = entry.imagePrompt?.trim() || `a calm, simple scene evoking a ${entry.mood} mood`;
      const image = await generateIllustration(scenePrompt);
      await saveEntry({ ...entry, image });
    } catch (err) {
      const hint = err instanceof IllustrateError ? err.hint : undefined;
      setIllustrateError({
        msg: err instanceof Error ? err.message : "Couldn't create the illustration.",
        hint,
      });
    } finally {
      setIllustrating(false);
    }
  }

  async function removeIllustration() {
    setIllustrateError(null);
    await saveEntry({
      ...entry,
      image: undefined,
      // A header choice pointing at the removed art falls back to auto.
      header: entry.header === "illustration" ? undefined : entry.header,
    });
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="paper-surface group relative overflow-hidden rounded-2xl border border-hairline/70 bg-surface/85 p-6 shadow-page backdrop-blur-sm"
    >
      {/* The chosen header art leads (writer's pick, else illustration → first
          photo); the local mood-scene stands in for significant entries. */}
      {resolveHeader(entry) ? (
        <EntryHeader entry={entry} />
      ) : entry.significant ? (
        <div className="relative -mx-6 -mt-6 mb-5 h-44 overflow-hidden rounded-t-2xl">
          <SceneImage entry={entry} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface/85" />
        </div>
      ) : null}

      {!editing && (
        <EntryMenu
          entry={entry}
          onEdit={() => setEditing(true)}
          onIllustrate={illustrate}
          onRemoveIllustration={removeIllustration}
          hasImage={!!entry.image}
          busy={illustrating}
        />
      )}

      {illustrating && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-lavender/10 px-3 py-2 text-xs text-lavender">
          <span className="h-3.5 w-3.5 animate-breathe rounded-full bg-gradient-to-br from-terracotta/60 via-lavender/60 to-sage/60" />
          Illustrating this moment…
        </div>
      )}

      <AnimatePresence>
        {illustrateError && !illustrating && (
          <IllustrationErrorDialog
            error={illustrateError}
            onClose={() => setIllustrateError(null)}
            onRetry={() => {
              setIllustrateError(null);
              void illustrate();
            }}
          />
        )}
      </AnimatePresence>

      {/* Stamp order: [📍 place ·] date · time zone · mood — place omitted when not recorded. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {entry.place && (
          <>
            <span className="flex items-center gap-1" title={placeLabel(entry.place)}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="text-lavender"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {entry.place.name}
            </span>
            <span aria-hidden>·</span>
          </>
        )}
        <time dateTime={new Date(entry.createdAt).toISOString()}>
          {formatDate(entry.createdAt, entry.timezone)} · {formatTime(entry.createdAt, entry.timezone)}
          {zoneDiffers(entry.timezone) && entry.timezone
            ? ` ${shortZone(entry.createdAt, entry.timezone)}`
            : ""}
        </time>
        <span aria-hidden>·</span>
        <span className="italic text-lavender">{entry.mood}</span>
      </div>

      {editing ? (
        <EntryEditor entry={entry} onDone={() => setEditing(false)} />
      ) : (
        <>
          <h2 className="font-serif text-2xl leading-snug text-ink">{entry.title}</h2>

          <p className="mt-3 max-w-[70ch] whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-ink/90">
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
            {entry.model === "self" ? "your words" : `shaped by ${modelLabel(entry.model)}`}
            {entry.source === "voice" ? " · spoken" : ""}
          </div>
        </>
      )}
    </motion.article>
  );
}

/** The ⋯ menu in the corner: edit, illustrate, or delete with an inline confirm. */
function EntryMenu({
  entry,
  onEdit,
  onIllustrate,
  onRemoveIllustration,
  hasImage,
  busy,
}: {
  entry: JournalEntry;
  onEdit: () => void;
  onIllustrate: () => void;
  onRemoveIllustration: () => void;
  hasImage: boolean;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  function run(fn: () => void) {
    fn();
    close();
  }

  return (
    <div className="absolute right-3 top-3 z-20">
      {open && (
        // Click-away layer so a tap elsewhere dismisses the menu.
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-0 cursor-default"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Entry options"
        aria-expanded={open}
        className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-muted opacity-70 shadow-soft backdrop-blur-sm transition-opacity hover:text-ink hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-hairline/70 bg-surface shadow-lift">
          {confirming ? (
            <div className="p-3">
              <p className="text-xs text-muted">Delete this entry? This can&rsquo;t be undone.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  className="flex-1 rounded-lg bg-terracotta px-3 py-1.5 text-xs font-medium text-paper transition-transform active:scale-95"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition-transform active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => run(onEdit)}
                className="block w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper/60"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(onIllustrate)}
                className="block w-full border-t border-hairline/50 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper/60 disabled:opacity-50"
              >
                {hasImage ? "Regenerate illustration" : "Illustrate this entry"}
              </button>
              {hasImage && (
                <button
                  type="button"
                  onClick={() => run(onRemoveIllustration)}
                  className="block w-full border-t border-hairline/50 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper/60"
                >
                  Remove illustration
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="block w-full border-t border-hairline/50 px-4 py-2.5 text-left text-sm text-terracotta transition-colors hover:bg-paper/60"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shown when an illustration fails: the captured error + fix, an embedded model
 * picker (refresh + choose + update) so you can switch models and retry on the
 * spot, and selectable error text you can copy to work through a fix with me.
 */
function IllustrationErrorDialog({
  error,
  onClose,
  onRetry,
}: {
  error: { msg: string; hint?: string };
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Illustration failed"
    >
      <motion.div
        initial={{ scale: 0.97, y: 6 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-hairline/70 bg-surface p-5 shadow-lift"
      >
        <h3 className="font-serif text-lg text-ink">Couldn&rsquo;t create the illustration</h3>
        <p className="mt-2 select-text text-sm text-terracotta">{error.msg}</p>
        {error.hint && <p className="mt-1 select-text text-sm text-muted">{error.hint}</p>}

        <div className="mt-4 border-t border-hairline/50 pt-4">
          <p className="text-xs font-medium text-ink">Try a different model</p>
          <p className="mt-1 text-xs text-muted">Refresh, pick one, Update — then it retries.</p>
          <div className="mt-3">
            <ModelChooser onUpdated={onRetry} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm font-medium text-ink transition-transform active:scale-95"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.02] active:scale-95"
          >
            Retry
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Inline edit of the words that make an entry: title, body, mood — and which
 * image leads the card (illustration or any photo; Auto = illustration first). */
function EntryEditor({ entry, onDone }: { entry: JournalEntry; onDone: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [mood, setMood] = useState(entry.mood);
  const [themesText, setThemesText] = useState(entry.themes.join(", "));
  const [headerSel, setHeaderSel] = useState(entry.header ?? "");
  const [saving, setSaving] = useState(false);

  const headerChoices = [
    ...(entry.image ? [{ id: "illustration", src: entry.image, label: "Illustration" }] : []),
    ...(entry.photos ?? []).map((p, i) => ({ id: p.id, src: p.thumb, label: `Photo ${i + 1}` })),
  ];

  async function save() {
    setSaving(true);
    const themes = [...new Set(themesText.split(",").map((t) => t.trim()).filter(Boolean))];
    await saveEntry({
      ...entry,
      title: title.trim() || entry.title,
      body: body.trim() || entry.body,
      mood: mood.trim() || entry.mood,
      themes,
      header: headerSel || undefined,
    });
    setSaving(false);
    onDone();
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Entry title"
        className="w-full rounded-lg border border-hairline bg-paper/40 px-3 py-2 font-serif text-2xl leading-snug text-ink focus:border-lavender/60 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        aria-label="Entry text"
        className="mt-3 w-full resize-none rounded-lg border border-hairline bg-paper/40 px-3 py-2 font-serif text-[1.05rem] leading-relaxed text-ink/90 focus:border-lavender/60 focus:outline-none"
      />
      <label className="mt-3 flex items-center gap-2 text-xs text-muted">
        Mood
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          aria-label="Entry mood"
          className="w-40 rounded-lg border border-hairline bg-paper/40 px-2 py-1 text-sm italic text-lavender focus:border-lavender/60 focus:outline-none"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Themes
        <input
          value={themesText}
          onChange={(e) => setThemesText(e.target.value)}
          placeholder="work, family, quiet mornings"
          aria-label="Entry themes"
          className="w-full rounded-lg border border-hairline bg-paper/40 px-2 py-1.5 text-sm text-sage focus:border-lavender/60 focus:outline-none"
        />
        <span className="text-[0.7rem] text-muted/70">Separate with commas.</span>
      </label>

      {headerChoices.length >= 2 && (
        <div className="mt-4">
          <p className="text-xs text-muted">Header image</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHeaderSel("")}
              aria-pressed={headerSel === ""}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                headerSel === ""
                  ? "border-lavender bg-lavender/15 text-lavender"
                  : "border-hairline text-muted hover:text-ink"
              }`}
            >
              Auto
            </button>
            {headerChoices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setHeaderSel(c.id)}
                aria-pressed={headerSel === c.id}
                title={c.label}
                className={`overflow-hidden rounded-lg border-2 transition-colors ${
                  headerSel === c.id ? "border-lavender" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                <img src={c.src} alt={c.label} className="h-14 w-20 object-cover" />
              </button>
            ))}
          </div>
          <p className="mt-1 text-[0.7rem] text-muted/70">
            Auto shows the illustration first, else your first photo.
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="flex-1 rounded-full border border-hairline bg-surface/60 px-5 py-2.5 text-sm font-medium text-ink transition-transform enabled:active:scale-95 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
