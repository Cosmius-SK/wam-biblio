"use client";

import { db, type AiLogRow } from "./db";
import { estimateCost } from "./format";

/**
 * The AI usage ledger: one row per live call, logged fire-and-forget at each
 * call site. Sample-mode previews return no usage and are never logged, so
 * the ledger reflects real spend only. Per-device by design (not synced).
 */
/** Estimated cost per generated image in USD. Gemini bills an image as ~1,290
 * output tokens (≈ $0.04 at Flash-image rates) on billing-enabled (Tier 1+)
 * keys; free-tier keys aren't charged, so this is an upper-bound estimate. */
const IMAGE_COST_USD = 0.04;

export async function logAi(input: {
  feature: AiLogRow["feature"];
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  images?: number;
}): Promise<void> {
  try {
    await db.ailog.put({
      id: crypto.randomUUID(),
      at: Date.now(),
      feature: input.feature,
      model: input.model,
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
      cost: input.usage
        ? estimateCost(input.model, input.usage.inputTokens, input.usage.outputTokens)
        : (input.images ?? 0) * IMAGE_COST_USD,
      images: input.images,
    });
  } catch {
    /* the ledger must never break the feature it observes */
  }
}
