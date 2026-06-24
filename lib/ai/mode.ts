import "server-only";

/**
 * The single spend switch. Default is "sample" — every AI feature returns a
 * local, zero-cost preview (no Anthropic/Gemini calls), so the whole app is
 * fully usable for free. Set `AI_MODE=live` (and add credit) to use real
 * model calls. Read at request time so flipping the env var doesn't need code
 * changes.
 */
export function aiLive(): boolean {
  return (process.env.AI_MODE ?? "sample").toLowerCase() === "live";
}
