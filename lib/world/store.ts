"use client";

import { db, notifyDataChanged } from "../db";
import { namesOf, type WorldKind, type WorldMember } from "./types";

/**
 * The cast, on disk.
 *
 * Ordinary Dexie, with one deliberate difference from the other tables: saving
 * asks for a sync push explicitly. A member is edited by a person tapping
 * through an avatar builder, which is closer to writing a draft than to
 * keeping an entry — the table hooks would fire on every adjustment.
 */
export async function listWorld(kind?: WorldKind): Promise<WorldMember[]> {
  const all = await db.world.orderBy("name").toArray();
  return kind ? all.filter((m) => m.kind === kind) : all;
}

export async function getMember(id: string): Promise<WorldMember | undefined> {
  return db.world.get(id);
}

export async function saveMember(member: WorldMember): Promise<void> {
  await db.world.put({ ...member, updatedAt: Date.now() });
  notifyDataChanged();
}

export async function deleteMember(id: string): Promise<void> {
  await db.world.delete(id);
  notifyDataChanged();
}

/**
 * Which of these names biblio already knows.
 *
 * Matching is on the name as written, plus any alias — never fuzzy. A wrong
 * match here would put someone else's face in your picture, which is a far
 * worse failure than not matching at all.
 */
export function matchNames(members: WorldMember[], names: string[]): WorldMember[] {
  const wanted = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return [];
  const out: WorldMember[] = [];
  for (const m of members) {
    const mine = namesOf(m);
    if (wanted.some((w) => mine.includes(w))) out.push(m);
  }
  return out;
}

/**
 * The names in this entry that biblio does *not* know yet — the offer to make
 * after an illustration, and nothing more than that. Short names are skipped:
 * two letters match too much to be a person.
 */
export function unknownNames(members: WorldMember[], names: string[]): string[] {
  const known = new Set(members.flatMap(namesOf));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name.length < 3 || known.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Every name biblio knows, for putting right what a recogniser mangles.
 *
 * "biblio" is always in it: it is the word certain to be said in a first
 * attempt and the one no dictation engine has ever heard of.
 */
export async function knownNames(): Promise<string[]> {
  try {
    const all = await listWorld();
    return ["biblio", ...all.flatMap((m) => [m.name, ...(m.aka ?? [])])]
      .map((n) => n.trim())
      .filter(Boolean);
  } catch {
    return ["biblio"];
  }
}
