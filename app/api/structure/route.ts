import { NextResponse } from "next/server";
import type { StructureRequest } from "@/lib/types";
import { structureEntry } from "@/lib/ai/claude";
import { aiLive } from "@/lib/ai/mode";
import { sampleStructure } from "@/lib/sample";
import { checkCaps, costOf, currentUser, recordUsage } from "@/lib/users/limits";

export const runtime = "nodejs";

/**
 * POST /api/structure
 * Takes a raw thought (+ light recent context) and returns an AI-structured
 * entry. The server is stateless — it stores nothing; context is supplied by
 * the local-first client and the result is persisted in the browser.
 */
export async function POST(request: Request) {
  let body: StructureRequest;
  try {
    body = (await request.json()) as StructureRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.raw || !body.raw.trim()) {
    return NextResponse.json({ error: "Nothing to shape — the thought is empty." }, { status: 400 });
  }

  // Sample mode (default): free local preview, no model call.
  if (!(await aiLive())) {
    return NextResponse.json(sampleStructure(body));
  }

  // Who is asking, and may they? The check is before the spend, the record is
  // after it — so a call that fails costs nobody anything.
  const asker = await currentUser();
  const denied = await checkCaps(asker, "text");
  if (denied) return NextResponse.json(denied, { status: 429 });

  try {
    const result = await structureEntry({
      raw: body.raw,
      source: body.source === "voice" ? "voice" : "text",
      recent: body.recent,
      markedSignificant: body.markedSignificant,
      shapeMode: body.shapeMode === "rephrase" || body.shapeMode === "deep" ? body.shapeMode : undefined,
      occurredAt: typeof body.occurredAt === "string" ? body.occurredAt.slice(0, 64) : undefined,
      placeName: typeof body.placeName === "string" ? body.placeName.slice(0, 128) : undefined,
    });
    await recordUsage(asker, "text", costOf(result.model, result.usage));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to shape the entry";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
