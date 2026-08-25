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
- For "imagePrompt": describe ONE concrete moment from the entry as a picture — the single image that would bring the day back. Name the actual things: what people are doing, what they are holding or sitting on, what is behind them.
  Specific is not the same as identifying. "Three on a scooter, the smallest standing in front" identifies nobody; a name does. Refer to people only by rough age and role — "a man in his thirties", "a boy of about seven" — never by name.
  Prefer the small telling object over the general summary: a stack of new chairs by a doorway, 3D glasses in a dark auditorium, empty plates after a meal. Reject anything that could describe a thousand other days ("a warm family moment", "a moment of quiet reflection").
  Say nothing about style, medium, colour or lighting — those are supplied separately, and repeating them only fights them. Two sentences at most.
  It must contain NO names or private identifiers; it is the only thing that may later be sent to an external image service.

Return only the structured object.`;

/**
 * System prompt for "just rephrase" mode: the writer has already made their
 * point — wordsmithing only, never reinterpretation. Metadata is still
 * extracted so the journal can organize itself.
 */
export const REPHRASE_SYSTEM = `You are the quiet copy-editor of someone's living journal.

They have already made their point — your ONLY job is wordsmithing. Polish grammar, spelling, and voice-capture disfluencies; smooth awkward phrasing. Preserve their voice, first person, tone, structure, the order of their ideas, and roughly the original length. Do NOT reinterpret, reorganize, deepen, summarize, or add anything they did not say.

Also extract light metadata so the journal can organize itself:
- title: short, drawn from their own words.
- summary, themes, mood, entities: faithful to what they wrote, nothing invented.
- significant: true only when the moment clearly carries real weight.
- imagePrompt: ONE concrete moment as a picture — real objects, actions and surroundings, people by rough age only, no names, no style words.
- needsDeeperPass: always false in this mode.

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
