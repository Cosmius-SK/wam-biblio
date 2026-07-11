import { NextResponse } from "next/server";
import { aiLive } from "@/lib/ai/mode";

export const runtime = "nodejs";

/**
 * POST /api/image — generate a simple, on-brand scene illustration via Gemini.
 *
 * Dormant unless Live AI is on, and only ever called on demand (the ⋯ menu on
 * a card), so it never spends by surprise. Only a SANITIZED scene prompt is
 * sent — never raw journal text.
 *
 * The model is never hard-pinned: it is resolved at request time from the key's
 * actually-available models (newest, stable, image-capable first), with an
 * optional GEMINI_IMAGE_MODEL env override and a small built-in fallback — so a
 * future Gemini version is picked up automatically instead of silently failing.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

// One place for the look: a calm, flat, textbook-style illustration in biblio's
// palette. No text, no photorealism — small on disk, gentle on the eye.
const STYLE_PREFIX =
  "A simple, friendly editorial line illustration in a calm storybook / textbook style: " +
  "clean thick outlines, flat shapes, generous negative space, and a limited warm palette of " +
  "soft sage green, dusty lavender, warm terracotta and cream paper. Soothing and understated, " +
  "not photorealistic, no 3D, no heavy shading or gradients. No text, letters, words, numbers, " +
  "or watermarks anywhere in the image. The scene to illustrate: ";

// Last-resort ids if model discovery is ever unavailable; discovery normally
// supersedes these. Ordered best-first.
const FALLBACK_MODELS = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];

interface ModelInfo {
  name?: string;
  supportedGenerationMethods?: string[];
}
interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string };
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

// Cached across warm invocations; short TTL so a newer model is picked up soon.
let modelCache: { ids: string[]; at: number } | null = null;
const MODEL_TTL = 6 * 60 * 60 * 1000;

const bare = (name: string) => name.replace(/^models\//, "");

/** Rank a Gemini image model: newer version wins; stable beats preview/exp. */
function rankModel(id: string): number {
  const v = id.match(/(\d+)\.(\d+)/);
  const version = v ? parseInt(v[1], 10) * 10 + parseInt(v[2], 10) : 0;
  const unstable = /(preview|exp|experimental)/i.test(id) ? 0.5 : 0;
  return version - unstable;
}

/** Gemini models that emit images via generateContent (excludes Imagen/predict). */
function isImageModel(m: ModelInfo): boolean {
  const id = bare(m.name ?? "").toLowerCase();
  return (
    id.startsWith("gemini") &&
    id.includes("image") &&
    (m.supportedGenerationMethods ?? []).includes("generateContent")
  );
}

/** Best-first list of image models to try: env pins, then discovered, then fallbacks. */
async function resolveModels(key: string, force = false): Promise<string[]> {
  if (!force && modelCache && Date.now() - modelCache.at < MODEL_TTL) return modelCache.ids;

  const envPref = (process.env.GEMINI_IMAGE_MODEL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let discovered: string[] = [];
  try {
    const res = await fetch(`${BASE}/models?pageSize=1000&key=${key}`);
    if (res.ok) {
      const data = (await res.json()) as { models?: ModelInfo[] };
      discovered = (data.models ?? [])
        .filter(isImageModel)
        .map((m) => bare(m.name!))
        .sort((a, b) => rankModel(b) - rankModel(a));
    }
  } catch {
    /* discovery unavailable — fall back to env pins + built-ins below */
  }

  const ordered: string[] = [];
  const push = (id: string) => {
    if (id && !ordered.includes(id)) ordered.push(id);
  };
  // Operator pins are trusted first (the manual lever), then the best discovered
  // models, then the built-in fallbacks.
  envPref.forEach(push);
  discovered.forEach(push);
  FALLBACK_MODELS.forEach(push);

  if (ordered.length) modelCache = { ids: ordered, at: Date.now() };
  return ordered;
}

interface GenOk {
  ok: true;
  image: string;
}
interface GenErr {
  ok: false;
  code: string;
  error: string;
  hint: string;
  status: number;
  /** Whether trying a different model could help (vs quota/key/safety). */
  retryModel: boolean;
}
type GenResult = GenOk | GenErr;

/** Map an HTTP status + Gemini error body to an actionable, specific failure. */
function classify(status: number, body: GeminiResponse): GenErr {
  const st = (body.error?.status ?? "").toUpperCase();
  const msg = body.error?.message ?? "";
  if (status === 429 || st === "RESOURCE_EXHAUSTED") {
    return {
      ok: false,
      code: "rate_limit",
      status: 429,
      error: "Gemini's free image quota is used up right now.",
      hint: "Wait for the daily free quota to reset, or enable billing on the API project. You can retry from the ⋯ menu anytime.",
      retryModel: false,
    };
  }
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(msg)) {
    return {
      ok: false,
      code: "invalid_key",
      status: 400,
      error: "The Gemini API key is invalid.",
      hint: "Regenerate GEMINI_API_KEY in Google AI Studio, update it in your Vercel env, and redeploy.",
      retryModel: false,
    };
  }
  if (status === 403 || st === "PERMISSION_DENIED") {
    return {
      ok: false,
      code: "api_disabled",
      status: 403,
      error: "This key can't access image generation.",
      hint: "Enable the 'Generative Language API' for the key's Google Cloud project, and remove any HTTP-referrer restriction that blocks server calls.",
      retryModel: false,
    };
  }
  if (status === 404 || st === "NOT_FOUND" || /not found|not supported|deprecated/i.test(msg)) {
    return {
      ok: false,
      code: "model_unavailable",
      status: 404,
      error: "That image model isn't available on this key.",
      hint: "Auto-selecting another. If this persists, set GEMINI_IMAGE_MODEL in your env to a current image model id from Google AI Studio.",
      retryModel: true,
    };
  }
  return {
    ok: false,
    code: "unknown",
    status: status || 502,
    error: msg || `Image API error (${status}).`,
    hint: "Retry in a moment. If it keeps failing, check the Gemini API status and your key.",
    retryModel: true,
  };
}

async function generateWith(key: string, model: string, prompt: string): Promise<GenResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: STYLE_PREFIX + prompt }] }] }),
    });
  } catch {
    return {
      ok: false,
      code: "network",
      status: 502,
      error: "Couldn't reach Gemini.",
      hint: "Check the connection and retry.",
      retryModel: false,
    };
  }

  let body: GeminiResponse = {};
  try {
    body = (await res.json()) as GeminiResponse;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) return classify(res.status, body);

  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    const blocked = body.promptFeedback?.blockReason || body.candidates?.[0]?.finishReason;
    return {
      ok: false,
      code: "no_image",
      status: 502,
      error: `Gemini returned no image${blocked ? ` (${blocked})` : ""}.`,
      hint: blocked
        ? "The scene wording may have tripped a safety filter — edit the entry and retry."
        : "The model responded without an image — retry, or try again later.",
      retryModel: false,
    };
  }
  const { data, mimeType } = part.inlineData;
  return { ok: true, image: `data:${mimeType ?? "image/png"};base64,${data}` };
}

export async function POST(request: Request) {
  if (!(await aiLive())) {
    return NextResponse.json(
      {
        error: "Illustrations need Live AI.",
        code: "sample_mode",
        hint: "Turn on Live AI (top bar) to generate an illustration.",
      },
      { status: 503 },
    );
  }

  let prompt: unknown;
  try {
    prompt = ((await request.json()) as { prompt?: unknown }).prompt;
  } catch {
    return NextResponse.json({ error: "Invalid request.", code: "bad_request", hint: "" }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "No scene prompt.", code: "bad_request", hint: "" }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "Image generation isn't configured.",
        code: "missing_key",
        hint: "Add GEMINI_API_KEY (from Google AI Studio) to your Vercel env and redeploy.",
      },
      { status: 503 },
    );
  }

  const models = await resolveModels(key);
  if (models.length === 0) {
    return NextResponse.json(
      {
        error: "No image model is available for this key.",
        code: "no_model",
        hint: "Set GEMINI_IMAGE_MODEL in your env to a current image model id from Google AI Studio (e.g. gemini-2.5-flash-image).",
      },
      { status: 502 },
    );
  }

  // Try candidates in order; only advance to another model on model-specific
  // errors — a quota/key/safety failure won't be helped by a different model.
  let last: GenErr | null = null;
  for (const model of models.slice(0, 4)) {
    const result = await generateWith(key, model, prompt);
    if (result.ok) {
      modelCache = { ids: [model, ...models.filter((m) => m !== model)], at: Date.now() };
      return NextResponse.json({ image: result.image, model });
    }
    last = result;
    if (result.code === "model_unavailable") modelCache = null; // re-discover next request
    if (!result.retryModel) break;
  }

  const err = last ?? {
    error: "Image generation failed.",
    code: "unknown",
    hint: "Retry in a moment.",
    status: 502,
  };
  return NextResponse.json(
    { error: err.error, code: err.code, hint: err.hint },
    { status: err.status >= 400 ? err.status : 502 },
  );
}
