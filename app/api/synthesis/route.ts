import { NextResponse } from "next/server";
import type { SynthesisRequest } from "@/lib/types";
import { synthesize } from "@/lib/ai/synthesis";
import { aiLive } from "@/lib/ai/mode";
import { sampleSynthesis } from "@/lib/sample";

export const runtime = "nodejs";

/**
 * POST /api/synthesis — a gentle "state of you" reflection over recent entries.
 * Stateless: the client sends the entries and persists the result locally.
 */
export async function POST(request: Request) {
  let body: SynthesisRequest;
  try {
    body = (await request.json()) as SynthesisRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: "Write a few entries first, then I can reflect with you." },
      { status: 400 },
    );
  }

  // Sample mode (default): free local reflection, no model call.
  if (!aiLive()) {
    return NextResponse.json(sampleSynthesis(body));
  }

  try {
    const result = await synthesize({ entries: body.entries });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reflect";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
