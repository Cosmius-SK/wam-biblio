import { NextResponse } from "next/server";
import { aiLive } from "@/lib/ai/mode";

export const runtime = "nodejs";

/**
 * POST /api/image — generate a real scene image via Gemini (free tier).
 * Dormant by default: in sample mode the client renders a local generated
 * scene instead, so this never runs (and never spends) until AI_MODE=live.
 * Only a sanitized scene prompt is sent — never raw journal text.
 */
interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string };
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

export async function POST(request: Request) {
  if (!aiLive()) {
    return NextResponse.json({ error: "Image generation is in sample mode." }, { status: 503 });
  }

  let prompt: unknown;
  try {
    prompt = ((await request.json()) as { prompt?: unknown }).prompt;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "No prompt provided." }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not set." }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Image API error (${res.status}).` }, { status: 502 });
    }

    const data = (await res.json()) as GeminiResponse;
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      return NextResponse.json({ error: "No image was returned." }, { status: 502 });
    }

    const { data: b64, mimeType } = part.inlineData;
    return NextResponse.json({ image: `data:${mimeType ?? "image/png"};base64,${b64}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
