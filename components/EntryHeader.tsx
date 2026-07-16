"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EntryPhoto, JournalEntry } from "@/lib/types";
import { resolveHeader } from "@/lib/entryHeader";
import { loadPhotoUrl } from "@/lib/media";

/**
 * The unified full-bleed header at the top of an entry card: the chosen hero
 * (the writer picks in Edit; auto = illustration first, else first photo)
 * spans the card width, and the remaining photos sit in a strip beneath.
 * When a photo is the hero, the illustration stays stored but hidden —
 * re-selectable anytime. Tapping opens a lightbox that closes on any tap.
 *
 * Note: the negative margins assume the parent card uses p-6 (see EntryCard).
 */
type Open = { photo?: EntryPhoto; src?: string } | null;

export default function EntryHeader({ entry }: { entry: JournalEntry }) {
  const [open, setOpen] = useState<Open>(null);
  const hero = resolveHeader(entry);
  if (!hero) return null;

  const photos = entry.photos ?? [];
  const strip = hero.kind === "photo" ? photos.filter((p) => p.id !== hero.photo.id) : photos;

  const cols =
    strip.length === 1
      ? "grid-cols-1"
      : strip.length === 2
        ? "grid-cols-2"
        : strip.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";
  const tileAspect = strip.length === 1 ? "aspect-[16/10]" : "aspect-square";

  return (
    <div className="-mx-6 -mt-6 mb-5 overflow-hidden rounded-t-2xl">
      <button
        type="button"
        onClick={() =>
          setOpen(hero.kind === "photo" ? { photo: hero.photo } : { src: hero.src })
        }
        aria-label={hero.kind === "photo" ? "View photo" : "View illustration"}
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL image */}
        <img
          src={hero.kind === "photo" ? hero.photo.thumb : hero.src}
          alt=""
          className="h-64 w-full object-cover"
        />
      </button>

      {strip.length > 0 && (
        <div className={`mt-1 grid gap-1 ${cols}`}>
          {strip.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen({ photo: p })}
              aria-label="View photo"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
              <img src={p.thumb} alt="" className={`${tileAspect} w-full object-cover`} />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && <Lightbox open={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Full-screen viewer: decrypts a photo on-device, or shows a direct source
 * (the illustration). The whole overlay — image included — closes on tap. */
function Lightbox({ open, onClose }: { open: NonNullable<Open>; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(open.src ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (open.photo) {
      (async () => {
        try {
          objectUrl = await loadPhotoUrl(open.photo!);
          if (!cancelled) setUrl(objectUrl);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't open the photo.");
        }
      })();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Image — tap to close"
    >
      <span
        aria-hidden
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
      >
        ✕
      </span>
      {url ? (
        <motion.img
          initial={{ scale: 0.96 }}
          animate={{ scale: 1 }}
          src={url}
          alt=""
          className="max-h-[88vh] max-w-full rounded-2xl shadow-lift"
        />
      ) : error ? (
        <p className="max-w-sm text-center text-sm text-white/90">{error}</p>
      ) : (
        <div className="h-12 w-12 animate-breathe rounded-full bg-gradient-to-br from-terracotta/60 via-lavender/60 to-sage/60" />
      )}
    </motion.div>
  );
}
