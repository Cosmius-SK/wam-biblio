"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EntryPhoto } from "@/lib/types";
import { loadPhotoUrl } from "@/lib/media";

/**
 * Thumbnails on an entry card; tapping one opens the full photo — fetched
 * from Drive and decrypted on-device in a soft lightbox.
 */
export default function PhotoStrip({ photos }: { photos: EntryPhoto[] }) {
  const [openPhoto, setOpenPhoto] = useState<EntryPhoto | null>(null);

  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-2">
        {photos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpenPhoto(p)}
              aria-label="View photo"
              className="block overflow-hidden rounded-xl border border-hairline/60 transition-transform hover:scale-[1.03] active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
              <img src={p.thumb} alt="" className="h-20 w-20 object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {openPhoto && <Lightbox photo={openPhoto} onClose={() => setOpenPhoto(null)} />}
      </AnimatePresence>
    </>
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Photo"
    >
      {url ? (
        <motion.img
          initial={{ scale: 0.96 }}
          animate={{ scale: 1 }}
          src={url}
          alt=""
          onClick={(e) => e.stopPropagation()}
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
