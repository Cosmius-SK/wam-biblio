import type { EntryPhoto, JournalEntry } from "./types";

/**
 * Which art leads an entry — on the card header, the book page, and the
 * gallery scene. The writer's explicit choice (entry.header) wins; otherwise
 * auto-precedence: illustration first, else the first photo. Null means no
 * real art (callers may fall back to the generated mood-scene).
 */
export type HeaderArt =
  | { kind: "illustration"; src: string }
  | { kind: "photo"; photo: EntryPhoto };

export function resolveHeader(entry: JournalEntry): HeaderArt | null {
  const photos = entry.photos ?? [];
  if (entry.header === "illustration" && entry.image) {
    return { kind: "illustration", src: entry.image };
  }
  if (entry.header) {
    const chosen = photos.find((p) => p.id === entry.header);
    if (chosen) return { kind: "photo", photo: chosen };
  }
  if (entry.image) return { kind: "illustration", src: entry.image };
  if (photos[0]) return { kind: "photo", photo: photos[0] };
  return null;
}
