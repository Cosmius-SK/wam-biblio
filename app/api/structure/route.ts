import { NextResponse } from "next/server";
import type { StructureRequest } from "@/lib/types";
import { structureEntry } from "@/lib/ai/claude";

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

  try {
    const result = await structureEntry({
      raw: body.raw,
      source: body.source === "voice" ? "voice" : "text",
      recent: body.recent,
      markedSignificant: body.markedSignificant,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to shape the entry";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
