import { db } from "./db";
import type { JournalEntry } from "./types";

/**
 * Synthetic sample entries — a realistic preview of the living journal while
 * we build out the remaining phases. Every demo entry is flagged `demo: true`
 * so it can be erased in one action before real use (see clearDemoEntries).
 *
 * Dates are computed relative to "now" at seed time so the timeline always
 * looks recent. IDs are stable (`demo-*`) so re-seeding upserts instead of
 * duplicating.
 */
const DAY = 24 * 60 * 60 * 1000;

function makeDemoEntries(): JournalEntry[] {
  const now = Date.now();
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
    return d.getTime();
  };

  const base: Omit<JournalEntry, "id" | "createdAt">[] = [
    {
      title: "The first morning",
      body: "First day at the new place. I keep rehearsing how I'll introduce myself and then forgetting it the second someone says hello. Under the nerves there's something good, though — the kind of fear that means I actually want this.",
      summary: "Nervous, hopeful first day at a new job.",
      themes: ["work", "beginnings"],
      mood: "restless",
      entities: ["new job"],
      significant: false,
      imagePrompt:
        "A cup of coffee on a clean desk by a tall window at early morning, soft pale light, quiet anticipation.",
      raw: "first day new job, kept forgetting my intro, nervous but the good kind of nervous",
      model: "claude-haiku-4-5",
      source: "text",
      demo: true,
    },
    {
      title: "Mom, on the phone",
      body: "Called Mom tonight, no reason really. She told the same story about the neighbour's garden that she told last week and I just let her. Halfway through I realised I wasn't waiting for it to end. I could listen to her tell me small things forever.",
      summary: "A tender, ordinary phone call with Mom.",
      themes: ["family", "love"],
      mood: "tender",
      entities: ["Mom"],
      significant: true,
      imagePrompt:
        "A warm kitchen at dusk, a phone resting against the shoulder, golden lamplight, a feeling of unhurried closeness.",
      raw: "called mom, she told the garden story again, didn't mind, could listen forever",
      model: "claude-sonnet-4-6",
      source: "voice",
      demo: true,
    },
    {
      title: "Too many open tabs",
      body: "Everything is technically fine and I still feel like I'm behind on all of it. Said yes to two more things today that I didn't have room for. I think I keep agreeing because the silence after 'no' scares me more than the work does.",
      summary: "Overwhelm and the habit of over-committing.",
      themes: ["work", "boundaries"],
      mood: "frayed",
      entities: [],
      significant: false,
      imagePrompt:
        "A desk seen from above scattered with papers and a dim screen, late afternoon shadows, a sense of quiet overwhelm.",
      raw: "everything's fine but I feel behind, said yes to two more things, why do I keep doing that",
      model: "claude-haiku-4-5",
      source: "text",
      demo: true,
    },
    {
      title: "Walk after the rain",
      body: "Walked the long way home after it stopped raining. The streets had that washed, shining look and almost no one was out. For about ten minutes I didn't think about anything I was supposed to do. I should remember that this is available to me whenever I want it.",
      summary: "A quiet, restorative evening walk after rain.",
      themes: ["solitude", "the city"],
      mood: "quiet",
      entities: [],
      significant: false,
      imagePrompt:
        "Empty city streets glistening after rain at dusk, reflections of streetlights, soft violet sky, gentle stillness.",
      raw: "walked the long way home after the rain, streets all shiny, didn't think about anything for once",
      model: "claude-haiku-4-5",
      source: "voice",
      demo: true,
    },
    {
      title: "An idea that won't leave",
      body: "I keep coming back to the journal idea — the one where you just say what you're thinking and it becomes something you'd actually want to read later. It feels less like a project and more like something I personally need. That's usually the sign worth trusting.",
      summary: "Excitement about the living-journal idea.",
      themes: ["creativity", "ideas"],
      mood: "hopeful",
      entities: ["the journal idea"],
      significant: false,
      imagePrompt:
        "A warm-lit room at night with a notebook open, a single plant, soft amber glow, the calm energy of an idea taking shape.",
      raw: "can't stop thinking about the journal idea, feels like something I need not just a project",
      model: "claude-sonnet-4-6",
      source: "text",
      demo: true,
    },
    {
      title: "Dinner with an old friend",
      body: "Saw J for the first time in almost a year. No catching-up awkwardness at all — we just fell back into it, the way good friendships hold their shape even when you leave them alone for a while. I laughed until my face hurt. I want to be better at not letting that much time pass.",
      summary: "A joyful, easy reunion dinner with an old friend.",
      themes: ["friendship", "gratitude"],
      mood: "grateful",
      entities: ["J"],
      significant: true,
      imagePrompt:
        "A cozy restaurant table at night, two glasses and warm candlelight, laughter in the air, deep amber and soft shadow.",
      raw: "dinner with J, first time in a year, fell right back into it, laughed so much",
      model: "claude-sonnet-4-6",
      source: "voice",
      demo: true,
    },
    {
      title: "Two weeks in",
      body: "Reading back over the last couple of weeks, there's a thread I didn't notice while I was living it: I'm happiest in the small, unproductive moments — the walk, the phone call, the long dinner. Maybe the thing to protect isn't my time so much as those.",
      summary: "Noticing a pattern: the small moments matter most.",
      themes: ["change", "self"],
      mood: "reflective",
      entities: [],
      significant: false,
      imagePrompt:
        "A window seat at golden hour with a blanket and an open book, dust motes in warm light, a settled, reflective calm.",
      raw: "looked back at the last two weeks, I'm happiest in the small moments, maybe that's what to protect",
      model: "claude-sonnet-4-6",
      source: "text",
      demo: true,
    },
  ];

  // Spread them across the past ~2 weeks, oldest first.
  const days = [13, 11, 9, 7, 5, 3, 1];
  const hours = [8, 21, 16, 19, 14, 20, 22];
  return base.map((e, i) => ({
    ...e,
    id: `demo-${i + 1}`,
    createdAt: at(days[i], hours[i]),
  }));
}

/** Insert (or refresh) the sample entries. */
export async function seedDemoEntries(): Promise<void> {
  await db.entries.bulkPut(makeDemoEntries());
}

/** Erase only the sample entries — leaves real entries untouched. */
export async function clearDemoEntries(): Promise<void> {
  await db.entries.where("id").startsWith("demo-").delete();
}
