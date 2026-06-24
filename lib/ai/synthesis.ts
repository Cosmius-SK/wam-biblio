import "server-only";
import type { SynthesisRequest, SynthesisResponse, EntryRef } from "@/lib/types";
import { routeModel } from "./router";
import { structuredCall, parseJsonObject } from "./client";

const SYNTHESIS_SYSTEM = `You write a brief "state of you" reflection from a stretch of someone's journal.

Read their recent entries and notice what they might not see themselves: recurring themes, a thread running through them, shifts in mood, tensions or small growth. Then write a short, gentle reflection addressed to them ("you"). Two short paragraphs at most. Weave observations together — do not produce a list or a summary of each entry, and never invent anything not grounded in the entries. Warm and human, not clinical or flattering. Title it with a few quiet words.

Return: title, reflection, and themes (the few threads you noticed).`;

const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    reflection: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
  },
  required: ["title", "reflection", "themes"],
  additionalProperties: false,
} as const;

function buildSynthesisUser(entries: EntryRef[]): string {
  const corpus = entries
    .map((e) => {
      const date = new Date(e.createdAt).toLocaleDateString();
      return `(${date}, mood: ${e.mood}) ${e.title}\n${e.body}`;
    })
    .join("\n\n---\n\n");
  return `Their recent entries (most recent first):\n\n${corpus}`;
}

export async function synthesize(req: SynthesisRequest): Promise<SynthesisResponse> {
  const model = routeModel({ operation: "synthesis" });
  const res = await structuredCall({
    model,
    system: SYNTHESIS_SYSTEM,
    user: buildSynthesisUser(req.entries),
    schema: SYNTHESIS_SCHEMA,
    maxTokens: 1200,
  });
  const d = parseJsonObject(res.text);
  return {
    title: String(d.title ?? "Where you are"),
    reflection: String(d.reflection ?? ""),
    themes: Array.isArray(d.themes) ? d.themes.map(String) : [],
    model,
    usage: { inputTokens: res.inputTokens, outputTokens: res.outputTokens },
  };
}
