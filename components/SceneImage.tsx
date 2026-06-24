"use client";

import { sceneDataUrl } from "@/lib/scene";
import type { JournalEntry } from "@/lib/types";

/**
 * The scene image for an entry: a real generated image if one is stored
 * (live mode), otherwise a deterministic, zero-cost "scene" from the entry's
 * mood. Same soft visual either way.
 */
export default function SceneImage({
  entry,
  className,
}: {
  entry: JournalEntry;
  className?: string;
}) {
  const src = entry.image || sceneDataUrl(`${entry.id}:${entry.imagePrompt}`, entry.mood);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-URL SVG / base64; next/image adds no value here
    <img
      src={src}
      alt={entry.imagePrompt || `A scene for "${entry.title}"`}
      loading="lazy"
      className={className}
    />
  );
}
