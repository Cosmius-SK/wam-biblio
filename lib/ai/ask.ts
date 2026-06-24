import "server-only";
import type { AskRequest, AskResponse, EntryRef } from "@/lib/types";
import { routeModel } from "./router";
import { structuredCall, parseJsonObject } from "./client";

const ASK_SYSTEM = `You help someone reflect by answering questions about their OWN journal.

You are given a set of their entries (each tagged with an [id]). Answer the question using ONLY what those entries say — never invent events, feelings, or facts that aren't there. Speak warmly and directly to them, in second person ("you"), the way a thoughtful friend who has read everything would. Be concise and honest. If the entries don't hold the answer, say so gently and suggest what they might reflect on or write next.

In "citations", list the [id]s of the entries your answer actually draws on (may be empty).`;

const ASK_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "citations"],
  additionalProperties: false,
} as const;

function buildAskUser(question: string, entries: EntryRef[]): string {
  const corpus = entries
    .map((e) => {
      const date = new Date(e.createdAt).toLocaleDateString();
      return `[${e.id}] (${date}, mood: ${e.mood}, themes: ${e.themes.join(", ")})\n${e.title}\n${e.body}`;
    })
    .join("\n\n---\n\n");
  return `Their entries:\n\n${corpus}\n\n========\n\nTheir question: ${question}`;
}

export async function answerQuestion(req: AskRequest): Promise<AskResponse> {
  const model = routeModel({ operation: "ask" });
  const res = await structuredCall({
    model,
    system: ASK_SYSTEM,
    user: buildAskUser(req.question, req.entries),
    schema: ASK_SCHEMA,
    maxTokens: 1500,
  });
  const d = parseJsonObject(res.text);
  return {
    answer: String(d.answer ?? ""),
    citations: Array.isArray(d.citations) ? d.citations.map(String) : [],
    model,
    usage: { inputTokens: res.inputTokens, outputTokens: res.outputTokens },
  };
}
