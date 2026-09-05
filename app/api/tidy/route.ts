import { NextResponse } from "next/server";
import { FLOOR_MODEL } from "@/lib/ai/router";
import { structuredCall, parseJsonObject } from "@/lib/ai/client";
import { aiLive } from "@/lib/ai/mode";
import { checkCaps, costOf, currentUser, recordUsage } from "@/lib/users/limits";

export const runtime = "nodejs";

/**
 * POST /api/tidy — punctuation and mis-hearings, and nothing else.
 *
 * Dictation is repaired in two places. Punctuation and sentence breaks are
 * inferred on the device for free (lib/speechText.ts) and need no model at
 * all. What no local rule can reach is a word the engine simply heard wrong —
 * "bilio" for "biblio", "as a speak" for "as I speak", "going to hell" for
 * "going to help" — because the sound was right and only the sentence around
 * it says otherwise.
 *
 * That correction already happens when an entry is kept, inside the shaping
 * pass, at no extra cost. This route exists so it can also happen *now*, on
 * request, while the words are still in the box — because a transcript that
 * looks broken is one nobody tries twice, whatever we promise it will become.
 *
 * Deliberately never automatic. It runs when somebody taps for it, on the
 * cheapest model, and returns text only: no title, no themes, no
 * interpretation. About a tenth of a cent.
 */
const SYSTEM = `You repair dictated text. You are given a raw speech-to-text transcript and you return the same words, correctly written.

Do exactly this and nothing else:
- Put in the punctuation and capitals: sentence breaks, question marks, commas where the sense needs them, paragraph breaks where the subject changes.
- Correct words the recogniser misheard. They are near-homophones that make no sense where they sit — "going to hell" for "going to help", "without any contest" for "without any context", "as a speak" for "as I speak", a mangled product or app name. Correct one ONLY when the intended word is unmistakable from the sentence around it. Anything you would be guessing at, leave exactly as it is.
- Remove spoken filler and false starts: "um", a word repeated twice, a sentence begun and restarted.

Do NOT rewrite their phrasing, improve their grammar, reorder anything, summarise, shorten, expand, or add a single idea they did not say. Someone must be able to read your output and their own words side by side and see only the machine's mistakes removed.

Return the repaired text.`;

const SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

const MAX_CHARS = 6000;

export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!raw) return NextResponse.json({ error: "Nothing to tidy." }, { status: 400 });

  // With AI off this is honestly unavailable rather than quietly a no-op: the
  // button that offers it is hidden in that mode.
  if (!(await aiLive())) {
    return NextResponse.json({ error: "AI is off for this deployment." }, { status: 503 });
  }

  const asker = await currentUser();
  const denied = await checkCaps(asker, "text");
  if (denied) return NextResponse.json(denied, { status: 429 });

  try {
    const res = await structuredCall({
      model: FLOOR_MODEL,
      system: SYSTEM,
      user: `Transcript:\n"""\n${raw}\n"""`,
      schema: SCHEMA,
      maxTokens: 2000,
    });
    const text = String(parseJsonObject(res.text).text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Nothing came back." }, { status: 502 });
    await recordUsage(asker, "text", costOf(FLOOR_MODEL, res));
    return NextResponse.json({ text, model: FLOOR_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't tidy that.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
