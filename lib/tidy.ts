"use client";

import { logAi } from "./usage";

/**
 * Ask for the dictation to be repaired — punctuation the device could not
 * infer, and words the recogniser misheard. See app/api/tidy/route.ts.
 *
 * Only ever from a tap. The same repair happens for free inside the shaping
 * pass when the entry is kept; this is for seeing it now.
 */
export async function tidyDictation(text: string): Promise<string> {
  const res = await fetch("/api/tidy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    model?: string;
    error?: string;
    hint?: string;
  };
  if (!res.ok || !data.text) {
    throw new Error([data.error, data.hint].filter(Boolean).join(" ") || "Couldn't tidy that.");
  }
  void logAi({ feature: "tidy", model: data.model || "floor" });
  return data.text;
}
