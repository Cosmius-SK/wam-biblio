"use client";

import { greeting } from "./format";

/**
 * Maya's words.
 *
 * Her register is quietly observant — she notices and reflects things back
 * sparingly (those lines are computed in mayaObserve.ts). But observation has
 * to be EARNED: a journal with three entries has no honest patterns in it, so
 * until there is something real to notice she stays warm and sparse, and grows
 * into noticing as the journal fills. She never guesses.
 */
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Enough of a journal for patterns to mean anything. */
export const OBSERVANT_FROM = 5;

export function greetingLine(name?: string): string {
  const who = name ? `, ${name}` : "";
  return pick([
    `${greeting()}${who}. Whenever you're ready.`,
    `${greeting()}${who}.`,
    `${greeting()}${who}. The page is open.`,
  ]);
}

export function emptyLine(): string {
  return pick([
    "Nothing here yet — and that's fine. Start anywhere.",
    "A blank page asks for very little. A sentence will do.",
    "Say one true thing. That's a beginning.",
  ]);
}

export function shapingLine(): string {
  return pick(["Reading what you meant…", "Listening…", "Finding the shape of it…"]);
}

export function savedLine(): string {
  return pick(["That's kept.", "Saved. It's yours now.", "Kept — the page remembers."]);
}

/** Warm and unobservant: what she says before the journal has patterns. */
export function sparseLine(): string {
  return pick([
    "Good to see you.",
    "The page is where you left it.",
    "Take your time.",
    "I'm here.",
  ]);
}

/* ------------------------------------------------------------------ *
 * Where she is standing
 *
 * The presence check is not a template with a suppression rule for the
 * capture screen. She says what a person would say from where she is —
 * which is what stops it being an interruption. Lines are composed from
 * parts rather than written out in full, because the cross-product would
 * run to hundreds and she would still repeat herself.
 * ------------------------------------------------------------------ */

export type Surface = "home" | "capture" | "gallery" | "ask" | "settings" | "card";

export interface PresenceAsk {
  text: string;
  /** How to say "still here" from this screen. Never a mood rating. */
  answers: string[];
}

/** Which screen this is, from the URL alone — no plumbing required. */
export function surfaceOf(pathname: string): Surface {
  if (pathname.startsWith("/capture")) return "capture";
  if (pathname.startsWith("/gallery")) return "gallery";
  if (pathname.startsWith("/ask")) return "ask";
  if (pathname.startsWith("/settings") || pathname.startsWith("/vault")) return "settings";
  return "home";
}

function dayPart(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/** Remember the last line used per key, so she doesn't repeat herself. */
const lastUsed = new Map<string, string>();

function pickFresh(key: string, list: string[]): string {
  if (list.length === 1) return list[0];
  const previous = lastUsed.get(key);
  const fresh = list.filter((l) => l !== previous);
  const chosen = pick(fresh.length > 0 ? fresh : list);
  lastUsed.set(key, chosen);
  return chosen;
}

const WHO = (name?: string) => (name ? `, ${name}` : "");

export function presenceAsk(surface: Surface, name?: string): PresenceAsk {
  const part = dayPart();
  const who = WHO(name);

  switch (surface) {
    case "capture":
      // Stillness here is someone composing a hard sentence, not someone
      // absent. She says so, and asks for a word rather than a face — a row
      // of smiling emoji over an entry about a death would be unforgivable.
      return {
        text: pickFresh("capture", [
          "Hope you're thinking deep. I'll wait.",
          "Take your time with it. I'm here.",
          "Some sentences are slow. That's fine.",
          "Still turning it over?",
        ]),
        answers: ["still here"],
      };
    case "gallery":
      return {
        text: pickFresh("gallery", [
          "Lovely, isn't it, seeing them all together.",
          "Anything here you'd forgotten?",
          `Still browsing${who}?`,
        ]),
        answers: ["👀"],
      };
    case "card":
      return {
        text: pickFresh("card", [
          "That should be a good memory, isn't it.",
          "Worth staying with for a minute.",
          "Reading it back is its own thing.",
        ]),
        answers: ["👀"],
      };
    case "ask":
      return {
        text: pickFresh("ask", [
          "Take your time — I'm not going anywhere.",
          "Still thinking of what to ask?",
        ]),
        answers: ["👀"],
      };
    case "settings":
      return {
        text: pickFresh("settings", [
          "Still fiddling with the knobs?",
          `Anything you want changed${who}?`,
        ]),
        answers: ["👋"],
      };
    default:
      return {
        text: pickFresh("home", [
          `It's a nice ${part}${who} — worth a visit to your gallery.`,
          `Still there${who}?`,
          `Quiet ${part}. The page is open whenever.`,
          "Nothing needs writing. I just wondered if you were still about.",
        ]),
        answers: ["👋", "👀"],
      };
  }
}

/**
 * The unfinished-draft nudge. Once on a new visit, never every unlock — the
 * difference between remembering something for someone and nagging them.
 */
export function draftNudgeLine(ago: string, name?: string): string {
  return pickFresh("nudge", [
    `You left something unfinished ${ago}. It's still there.`,
    `There's a thought from ${ago} waiting, whenever you want it.`,
    `Something from ${ago} is half-written${WHO(name)}. No hurry.`,
  ]);
}
