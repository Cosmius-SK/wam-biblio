import "server-only";
import type {
  StructureRequest,
  StructureResponse,
  AskRequest,
  AskResponse,
  SynthesisRequest,
  SynthesisResponse,
  EntryRef,
} from "./types";

/**
 * Zero-cost local previews for every AI feature. These run when AI_MODE is
 * "sample" (the default), so the entire app is usable without spending a cent
 * or calling Anthropic/Gemini. They are intentionally light — honest stand-ins
 * that show the real UX — and every response is tagged model: "sample".
 */

const STOP = new Set(
  "the a an and or but of to in on for with my me i it is are was were be been at as that this so just really very kind".split(
    " ",
  ),
);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}

const MOOD_CUES: [RegExp, string][] = [
  [/\b(afraid|anxious|nervous|worried|scared|dread)/i, "anxious"],
  [/\b(angry|furious|frustrat|annoyed)/i, "frustrated"],
  [/\b(sad|grief|cried|crying|low|down|empty)/i, "sad"],
  [/\b(lonely|alone|isolat)/i, "lonely"],
  [/\b(love|loved|tender|warm|close|dear)/i, "tender"],
  [/\b(hope|hopeful|excited|looking forward|can't wait)/i, "hopeful"],
  [/\b(grateful|thankful|blessed|appreciate)/i, "grateful"],
  [/\b(calm|peace|peaceful|still|quiet|rest)/i, "quiet"],
  [/\b(tired|exhausted|overwhelm|too much|behind)/i, "frayed"],
  [/\b(proud|accomplish|achieved|finished)/i, "proud"],
];

function moodFromText(text: string): string {
  for (const [re, mood] of MOOD_CUES) if (re.test(text)) return mood;
  return "reflective";
}

const THEME_CUES: [RegExp, string][] = [
  [/\b(work|job|office|meeting|deadline|boss|career)/i, "work"],
  [/\b(mom|dad|mother|father|family|sister|brother|parent)/i, "family"],
  [/\b(friend|friends|dinner|hang)/i, "friendship"],
  [/\b(love|partner|relationship|date)/i, "love"],
  [/\b(walk|run|gym|sleep|body|health|tired)/i, "the body"],
  [/\b(idea|build|create|writing|project|design)/i, "creativity"],
  [/\b(money|rent|spend|budget|bills)/i, "money"],
  [/\b(future|change|decision|choose|plan)/i, "change"],
  [/\b(home|house|city|move|place)/i, "place"],
];

function themesFromText(text: string): string[] {
  const out: string[] = [];
  for (const [re, theme] of THEME_CUES) if (re.test(text) && !out.includes(theme)) out.push(theme);
  return out.length ? out.slice(0, 3) : ["reflections"];
}

function titleFromText(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  const firstClause = clean.split(/[,.;!?]/)[0] || clean;
  const w = firstClause.split(" ").slice(0, 6).join(" ");
  const title = w.charAt(0).toUpperCase() + w.slice(1);
  return title.length < clean.length ? title : title;
}

function tidyBody(text: string): string {
  let b = text.trim().replace(/\s+/g, " ");
  b = b.charAt(0).toUpperCase() + b.slice(1);
  if (!/[.!?]$/.test(b)) b += ".";
  return b;
}

const SCENE_BY_MOOD: Record<string, string> = {
  anxious: "a dim room before dawn, restless grey light",
  frustrated: "a clouded sky with a single break of warm light",
  sad: "rain on a window at dusk, soft blue shadow",
  lonely: "an empty bench under a streetlamp at night",
  tender: "warm lamplight in a quiet kitchen at evening",
  hopeful: "first light over a calm field, pale gold and green",
  grateful: "a candlelit table, deep amber glow",
  quiet: "still water at twilight, violet and slate",
  frayed: "late-afternoon shadows across a cluttered desk",
  proud: "a clear horizon at golden hour",
  reflective: "a window seat at golden hour, dust motes in warm light",
};

function imagePromptFor(mood: string): string {
  const scene = SCENE_BY_MOOD[mood] ?? "a soft, calm scene in warm dusk light";
  return `A gentle, painterly scene: ${scene}. Soothing, atmospheric, no text.`;
}

/** Sample "shaping" of a raw thought — light cleanup + local metadata. */
export function sampleStructure(req: StructureRequest): StructureResponse {
  const raw = req.raw.trim();
  const mood = moodFromText(raw);
  return {
    entry: {
      title: titleFromText(raw),
      body: tidyBody(raw),
      summary: raw.split(/\s+/).slice(0, 14).join(" "),
      themes: themesFromText(raw),
      mood,
      entities: [],
      significant: Boolean(req.markedSignificant),
      imagePrompt: imagePromptFor(mood),
    },
    model: "sample",
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Sample answer — naive keyword retrieval + an honest, templated response. */
export function sampleAsk(req: AskRequest): AskResponse {
  const q = new Set(words(req.question));
  const scored = req.entries
    .map((e) => {
      const hay = new Set(words(`${e.title} ${e.summary} ${e.body} ${e.themes.join(" ")}`));
      let score = 0;
      q.forEach((w) => {
        if (hay.has(w)) score += 1;
      });
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);

  let picked = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.e);
  if (picked.length === 0) {
    picked = [...req.entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2);
  }

  const refs = picked
    .map((e) => `In “${e.title}”, ${lowerFirst(e.summary).replace(/\.$/, "")}.`)
    .join(" ");
  const answer = `From what you've written, a few entries speak to that. ${refs} (This is a sample answer drawn from your own entries — switch on live AI for a fuller, more thoughtful reading.)`;

  return {
    answer,
    citations: picked.map((e) => e.id),
    model: "sample",
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

function topCounts(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Sample "state of you" reflection — composed locally from the entries. */
export function sampleSynthesis(req: SynthesisRequest): SynthesisResponse {
  const entries: EntryRef[] = req.entries;
  const themes = topCounts(entries.flatMap((e) => e.themes), 4);
  const topMood = topCounts(entries.map((e) => e.mood), 1)[0] ?? "reflective";
  const recentTitles = [...entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2)
    .map((e) => `“${e.title}”`);

  const themeList =
    themes.length > 1
      ? `${themes.slice(0, -1).join(", ")} and ${themes[themes.length - 1]}`
      : themes[0] ?? "the quiet details of your days";

  const reflection =
    `Across your recent entries, the threads that keep returning are ${themeList}. ` +
    `The overall tone has been ${topMood} — present in moments like ${recentTitles.join(" and ")}. ` +
    `There's a steadiness in how you notice small things and let them matter. ` +
    `(This is a sample reflection assembled from your entries — turn on live AI for a deeper, more personal read.)`;

  return {
    title: "Where you are right now",
    reflection,
    themes,
    model: "sample",
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}
