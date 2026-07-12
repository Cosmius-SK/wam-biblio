import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/quote — the footer's quote of the day. Hybrid: try a free quote
 * service (filtered to on-tone tags) with a short timeout, cached for the
 * day; fall back to a hand-picked set so the footer is never broken or
 * off-tone. Deterministic per day either way.
 */
const CURATED: { q: string; a: string }[] = [
  { q: "Be kind, for everyone you meet is fighting a hard battle.", a: "Ian Maclaren" },
  { q: "Gratitude turns what we have into enough.", a: "Anonymous" },
  { q: "Nothing can bring you peace but yourself.", a: "Ralph Waldo Emerson" },
  { q: "The wound is the place where the light enters you.", a: "Rumi" },
  { q: "Happiness depends upon ourselves.", a: "Aristotle" },
  { q: "No act of kindness, no matter how small, is ever wasted.", a: "Aesop" },
  { q: "The quieter you become, the more you are able to hear.", a: "Rumi" },
  {
    q: "Enjoy the little things, for one day you may look back and realize they were the big things.",
    a: "Robert Brault",
  },
  { q: "He who has a why to live can bear almost any how.", a: "Friedrich Nietzsche" },
  { q: "The best way out is always through.", a: "Robert Frost" },
  { q: "Wherever you go, go with all your heart.", a: "Confucius" },
  { q: "Little by little, one travels far.", a: "Spanish proverb" },
  {
    q: "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.",
    a: "Thích Nhất Hạnh",
  },
  {
    q: "In the middle of winter I at last discovered that there was in me an invincible summer.",
    a: "Albert Camus",
  },
  { q: "Act as if what you do makes a difference. It does.", a: "William James" },
  { q: "This too shall pass.", a: "Persian adage" },
  {
    q: "Gratitude is not only the greatest of virtues, but the parent of all the others.",
    a: "Cicero",
  },
  {
    q: "When we are no longer able to change a situation, we are challenged to change ourselves.",
    a: "Viktor E. Frankl",
  },
];

let cache: { day: string; q: string; a: string } | null = null;

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function curatedForToday(): { q: string; a: string } {
  const day = Math.floor(Date.now() / 86_400_000);
  return CURATED[day % CURATED.length];
}

export async function GET() {
  const day = dayKey();
  if (cache?.day === day) return NextResponse.json(cache);

  try {
    const res = await fetch(
      "https://api.quotable.io/quotes/random?tags=wisdom|happiness|gratitude|life&maxLength=140",
      { signal: AbortSignal.timeout(4000), cache: "no-store" },
    );
    if (res.ok) {
      const arr = (await res.json()) as { content?: string; author?: string }[];
      const item = Array.isArray(arr) ? arr[0] : undefined;
      if (item?.content && item.author) {
        cache = { day, q: item.content, a: item.author };
        return NextResponse.json(cache);
      }
    }
  } catch {
    /* service down — the curated set never is */
  }

  cache = { day, ...curatedForToday() };
  return NextResponse.json(cache);
}
