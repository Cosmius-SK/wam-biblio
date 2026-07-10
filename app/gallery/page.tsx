"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { db } from "@/lib/db";
import SceneImage from "@/components/SceneImage";
import { SeedButton } from "@/components/DemoControls";
import { formatDate } from "@/lib/format";

/**
 * The Gallery — a soft, full-bleed wall of scenes, one per entry. Images are
 * generated for free from each entry's mood (or a real AI image in live mode).
 */
export default function GalleryPage() {
  const entries = useLiveQuery(() => db.entries.orderBy("createdAt").reverse().toArray());

  return (
    <div>
      <div className="mb-8 mt-4">
        <h1 className="font-serif text-3xl text-ink">Scenes</h1>
        <p className="mt-1 text-muted">An image for each moment, the way it felt.</p>
      </div>

      {entries === undefined ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface/50" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface/40 p-10 text-center">
          <p className="font-serif text-xl text-ink">No scenes yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Each entry becomes a soft scene here. Load a few to see how it looks.
          </p>
          <div className="mt-4 flex justify-center">
            <SeedButton />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {entries.map((entry, i) => (
            <motion.figure
              key={entry.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.4) }}
              className={`group relative overflow-hidden rounded-2xl border border-hairline/60 shadow-soft ${
                entry.significant ? "col-span-2 h-56" : "h-40"
              }`}
            >
              <SceneImage
                entry={entry}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-serif text-lg leading-tight text-white drop-shadow">{entry.title}</p>
                <p className="mt-0.5 text-xs text-white/80">
                  {formatDate(entry.createdAt, entry.timezone)} · {entry.mood}
                </p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}
    </div>
  );
}
