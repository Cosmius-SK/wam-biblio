"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EntryPhoto } from "@/lib/types";
import { loadPhotoUrl } from "@/lib/media";

/**
 * Full-bleed photo header at the top of an entry card. The first photo spans
 * the card width; any others sit in a small strip beneath it. Tapping any of
 * them opens a lightbox that decrypts the original on-device — and tapping
 * anywhere (or Esc) closes it.
 *
 * Note: the negative margins assume the parent card uses p-6 (see EntryCard).
 */
export default function PhotoHeader({ photos }: { photos: EntryPhoto[] }) {
  const [open, setOpen] = useState<EntryPhoto | null>(null);
  const hero = photos[0];
  const rest = photos.slice(1);

  // The extra photos fill the full card width — one wide, or an even grid.
  const cols =
    rest.length === 1
      ? "grid-cols-1"
      : rest.length === 2
        ? "grid-cols-2"
        : rest.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";
  const tileAspect = rest.length === 1 ? "aspect-[16/10]" : "aspect-square";

  return (
    <div className="-mx-6 -mt-6 mb-5 overflow-hidden rounded-t-2xl">
      <button
        type="button"
        onClick={() => setOpen(hero)}
        aria-label="View photo"
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
        <img src={hero.thumb} alt="" className="h-64 w-full object-cover" />
      </button>

      {rest.length > 0 && (
        <div className={`mt-1 grid gap-1 ${cols}`}>
          {rest.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(p)}
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
        {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Lightbox({ photo, onClose }: { photo: EntryPhoto; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        objectUrl = await loadPhotoUrl(photo);
        if (!cancelled) setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't open the photo.");
      }
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo, onClose]);

  // The whole overlay — image included — closes on tap (no stopPropagation).
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Photo — tap to close"
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
