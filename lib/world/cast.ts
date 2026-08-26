"use client";

import { listWorld } from "./store";
import { describeMember, namesOf, type WorldMember } from "./types";

/**
 * From what an entry says to what a picture is told.
 *
 *   entry mentions "Theva" → matched here → the DESCRIPTION is injected
 *
 * The privacy rule survives intact: names are matched on the device and never
 * travel; what travels is "a man in his thirties with a full beard", which
 * identifies nobody to anyone who was not already at the table.
 *
 * This is the whole reason for the cast. Without it every illustration invents
 * its people from scratch, so a family is a different family in every picture.
 */

/** More than a few described people and the image model loses all of them. */
const MAX_PEOPLE = 4;
const MAX_THINGS = 3;
/** A prompt that is mostly cast is a prompt that has stopped being a scene. */
const CAP = 480;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole word only — "Ana" must not match "banana", or "Ravi" "Ravindra". */
function mentions(text: string, name: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${escape(name)}([^\\p{L}]|$)`, "iu").test(text);
}

/**
 * Everyone in this entry that biblio already knows.
 *
 * Two sources, because neither alone is enough: `entities` is what the shaping
 * pass pulled out and is usually right, and a plain scan of the writing itself
 * catches the people it missed. Matching is exact — a wrong match puts someone
 * else's face in your picture, which is much worse than no match at all.
 */
export function matchEntry(
  members: WorldMember[],
  entry: { entities?: string[]; title?: string; body?: string; raw?: string },
): WorldMember[] {
  const entities = (entry.entities ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const text = `${entry.title ?? ""} ${entry.body ?? ""} ${entry.raw ?? ""}`;
  const out: WorldMember[] = [];
  for (const m of members) {
    const names = namesOf(m);
    const hit =
      names.some((n) => entities.includes(n)) ||
      names.some((n) => n.length >= 3 && mentions(text, n));
    if (hit) out.push(m);
  }
  return out;
}

/** The sentence appended to a scene prompt. Empty when nobody is known yet. */
export function castLine(members: WorldMember[]): string {
  const people = members
    .filter((m) => m.kind === "person")
    .slice(0, MAX_PEOPLE)
    .map(describeMember)
    .filter(Boolean);
  const others = members
    .filter((m) => m.kind !== "person")
    .slice(0, MAX_THINGS)
    .map(describeMember)
    .filter(Boolean);

  const parts: string[] = [];
  if (people.length > 0) {
    parts.push(
      `The people in this scene look like this — ${people.join("; ")}. Keep them consistent and do not add other people.`,
    );
  }
  if (others.length > 0) parts.push(`Also in it: ${others.join("; ")}.`);
  return parts.join(" ").slice(0, CAP);
}

/**
 * The scene prompt with whoever biblio recognises appended.
 *
 * Deliberately client-side. The cast lives on the device, the match happens on
 * the device, and the route keeps receiving exactly what it always received:
 * one sanitized scene description with no names in it.
 */
export async function promptWithCast(
  prompt: string,
  entry: { entities?: string[]; title?: string; body?: string; raw?: string },
): Promise<string> {
  try {
    const known = matchEntry(await listWorld(), entry);
    const line = castLine(known);
    return line ? `${prompt} ${line}` : prompt;
  } catch {
    return prompt; // a picture without the cast beats no picture
  }
}
