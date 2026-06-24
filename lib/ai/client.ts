import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client + a structured-output helper used by every AI
 * feature (structuring, ask, synthesis). Centralizes the model call, prompt
 * caching of the stable system prompt, and JSON parsing so each feature only
 * defines its prompt + schema.
 */
let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it to .env.local");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface StructuredCallOpts {
  model: string;
  /** Stable per-feature system prompt (cached). */
  system: string;
  /** Volatile user-turn content (the actual request + context). */
  user: string;
  /** JSON schema the response must satisfy. */
  schema: unknown;
  maxTokens?: number;
}

export interface StructuredCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function structuredCall(opts: StructuredCallOpts): Promise<StructuredCallResult> {
  const params = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2000,
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: { type: "json_schema", schema: opts.schema } },
  } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;

  const message = await client().messages.create(params);
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  return {
    text: block.text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

/** Defensive JSON-object parse: tolerate a model that wraps JSON in prose. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse a JSON object from Claude");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}
