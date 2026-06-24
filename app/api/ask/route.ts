import { NextResponse } from "next/server";
import type { AskRequest } from "@/lib/types";
import { answerQuestion } from "@/lib/ai/ask";
import { aiLive } from "@/lib/ai/mode";
import { sampleAsk } from "@/lib/sample";

export const runtime = "nodejs";

/**
 * POST /api/ask — answer a question over the entries the client retrieved.
 * Retrieval happens on the client (local-first); only the relevant entries are
 * sent here, and nothing is stored server-side.
 */
export async function POST(request: Request) {
  let body: AskRequest;
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.question || !body.question.trim()) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: "There aren't any entries to look through yet." },
      { status: 400 },
    );
  }

  // Sample mode (default): free local answer, no model call.
  if (!(await aiLive())) {
    return NextResponse.json(sampleAsk(body));
  }

  try {
    const result = await answerQuestion({
      question: body.question.trim(),
      entries: body.entries,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to answer";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
