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
