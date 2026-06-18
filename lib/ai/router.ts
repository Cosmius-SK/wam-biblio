/**
 * Model throttle ("the throttle Shiva asked for").
 *
 * Picks a Claude model PER CALL on cheap signals — no extra AI call to decide.
 * Most entries ride the cheap floor model (Haiku); the deeper ceiling model
 * (Sonnet) is reserved for entries that genuinely benefit, plus deep passes
 * (synthesis / ask-your-journal). The structuring path also supports an
 * escalation pattern: Haiku runs first and can flag itself for a Sonnet re-run.
 */

export const FLOOR_MODEL = process.env.AI_MODEL_FLOOR || "claude-haiku-4-5";
export const CEILING_MODEL = process.env.AI_MODEL_CEILING || "claude-sonnet-4-6";

export type Operation = "structure" | "synthesis" | "ask";

export interface RouteInput {
  operation: Operation;
  /** Raw text being processed (used for length/complexity heuristics). */
  text?: string;
  /** User explicitly marked this moment as significant. */
  markedSignificant?: boolean;
}

/** Rough word count without pulling in a tokenizer. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Heuristic complexity score in [0, 1]. Longer, more punctuated, more
 * emotionally-loaded text scores higher and biases toward the ceiling model.
 */
export function complexityScore(text: string): number {
  const words = wordCount(text);
  const lengthScore = Math.min(words / 220, 1); // ~220 words ≈ "long"

  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const multiTopic = Math.min(sentences / 8, 1);

  // Light emotional/ambiguity cue list — a stand-in for richer signals later.
  const cues =
    /\b(but|however|afraid|anxious|angry|grief|love|lonely|hope|regret|guilt|confus|overwhelm|why|should|maybe|conflict|torn|lost|proud|ashamed)/gi;
  const cueHits = Math.min((text.match(cues) || []).length / 4, 1);

  return Math.min(0.5 * lengthScore + 0.25 * multiTopic + 0.25 * cueHits, 1);
}

/** Decide which model to use for the FIRST pass of an operation. */
export function routeModel(input: RouteInput): string {
  // Deep, understanding-heavy operations always use the ceiling model.
  if (input.operation === "synthesis" || input.operation === "ask") {
    return CEILING_MODEL;
  }

  // A moment the user flagged as significant deserves the deeper model up front.
  if (input.markedSignificant) return CEILING_MODEL;

  // Otherwise route structuring by how rich the raw thought looks.
  const score = input.text ? complexityScore(input.text) : 0;
  return score >= 0.6 ? CEILING_MODEL : FLOOR_MODEL;
}
