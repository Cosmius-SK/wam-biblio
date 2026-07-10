"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { JournalEntry } from "@/lib/types";
import { deleteEntry, saveEntry } from "@/lib/db";
import { formatDate, formatTime, modelLabel, shortZone, zoneDiffers } from "@/lib/format";
import { placeLabel } from "@/lib/geo";
import SceneImage from "./SceneImage";
import PhotoHeader from "./PhotoHeader";

/** A single entry in the living timeline — reading-first, book-like. */
export default function EntryCard({
  entry,
  index = 0,
}: {
  entry: JournalEntry;
  index?: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="group relative rounded-2xl border border-hairline/70 bg-surface/70 p-6 shadow-soft backdrop-blur-sm"
    >
      {/* Real photos take the top; the generated scene is only a stand-in when there are none. */}
      {entry.photos && entry.photos.length > 0 ? (
        <PhotoHeader photos={entry.photos} />
      ) : entry.significant ? (
        <div className="relative -mx-6 -mt-6 mb-5 h-44 overflow-hidden rounded-t-2xl">
          <SceneImage entry={entry} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface/85" />
        </div>
      ) : null}

      {!editing && <EntryMenu onEdit={() => setEditing(true)} entry={entry} />}

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

          <p className="mt-3 whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-ink/90">
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

/** The ⋯ menu in the corner: edit, or delete with an inline confirm. */
function EntryMenu({ entry, onEdit }: { entry: JournalEntry; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(false);
    setConfirming(false);
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
                onClick={() => {
                  onEdit();
                  close();
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper/60"
              >
                Edit
              </button>
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

/** Inline edit of the words that make an entry: title, body, and mood. */
function EntryEditor({ entry, onDone }: { entry: JournalEntry; onDone: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [mood, setMood] = useState(entry.mood);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await saveEntry({
      ...entry,
      title: title.trim() || entry.title,
      body: body.trim() || entry.body,
      mood: mood.trim() || entry.mood,
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
