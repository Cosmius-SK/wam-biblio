import type { EntryContext } from "@/lib/types";

/**
 * System prompt for the structuring call. Stable across requests so it caches
 * well (prompt caching is per-model; see plan). The volatile pieces (recent
 * context, the raw thought) go in the user turn, after the cached prefix.
 */
export const STRUCTURE_SYSTEM = `You are the quiet scribe of someone's living journal.

They speak or type raw, unfiltered thoughts — fragments, tangents, half-formed feelings. Your job is to turn each one into a coherent journal entry that they will be glad to reread, WITHOUT changing what it means or how it feels.

Principles:
- Preserve their voice. Keep first person. Do not sanitize emotion, inflate, or moralize. If the thought is small, keep the entry small.
- Make it readable: fix disfluencies and fragments from voice capture, give it gentle shape, but never invent events, opinions, or details they did not express.
- Be warm and plain. No therapy-speak, no clichés, no "Dear diary".
- Extract light metadata that will help connect this entry to others over time.
- For "significant": true only when the moment carries real weight (a turning point, a strong emotion, a vivid scene) — not for routine notes.
- For "imagePrompt": write an evocative SCENE description suitable for an image model — mood, light, place, atmosphere. It must contain NO names or private identifiers; it is the only thing that may later be sent to an external image service.

Return only the structured object.`;

/** Build the user-turn content: recent context (if any) + the new raw thought. */
export function buildUserContent(
  raw: string,
  recent?: EntryContext[],
  about?: { when?: string; place?: string },
): string {
  let context = "";
  if (recent && recent.length > 0) {
    const lines = recent
      .map((r) => `- (${r.mood}) ${r.title} — ${r.summary} [${r.themes.join(", ")}]`)
      .join("\n");
    context = `Recent entries, for continuity (do not repeat or merge them; use only to keep tone and threads consistent):\n${lines}\n\n`;
  }
  let situ = "";
  if (about?.when || about?.place) {
    const bits = [about?.when, about?.place].filter(Boolean).join(", in ");
    situ = `This thought is about ${bits}. Use this only as quiet context (themes, tone) — do not state details the writer didn't mention.\n\n`;
  }
  return `${context}${situ}New raw thought to shape into an entry:\n"""\n${raw}\n"""`;
}

/**
 * JSON schema for Anthropic structured outputs. Includes `needsDeeperPass`,
 * which the cheap floor model uses to flag entries that warrant a re-run on the
 * ceiling model (the escalation throttle). The schema is shared by both models.
 */
export const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    summary: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    mood: { type: "string" },
    entities: { type: "array", items: { type: "string" } },
    significant: { type: "boolean" },
    imagePrompt: { type: "string" },
    needsDeeperPass: {
      type: "boolean",
      description:
        "True if this thought is emotionally rich, ambiguous, or important enough that a more capable model should rewrite it.",
    },
  },
  required: [
    "title",
    "body",
    "summary",
    "themes",
    "mood",
    "entities",
    "significant",
    "imagePrompt",
    "needsDeeperPass",
  ],
  additionalProperties: false,
} as const;
