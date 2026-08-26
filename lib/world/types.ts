/**
 * Your world: the people, places and things a journal keeps returning to.
 *
 * One store, three kinds, and only one of them needs a likeness. A person is a
 * face; a place is atmosphere ("a multiplex lobby, neon strips, dark patterned
 * carpet" is genuinely enough); a thing is a detail or two. See
 * docs/your-world.md.
 *
 * The privacy rule is unchanged and load-bearing: **names never leave the
 * device, descriptions do.** An entry mentioning "Theva" is matched here, and
 * what goes into the picture is "a man in his thirties with a full beard".
 */
import { describeFace, type Face } from "./face";

export type WorldKind = "person" | "place" | "thing";

export interface WorldMember {
  id: string;
  kind: WorldKind;
  /** What you call them when you write. Local only, always. */
  name: string;
  /** Other names for the same person — "Dad", "Appa", a spelling you drift between. */
  aka?: string[];
  /** People only: the choices behind the portrait. */
  face?: Face;
  /**
   * Their own words. The whole description for a place or a thing, and for a
   * person anything the options could not say — "always in a cricket shirt".
   */
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** What a member becomes in an image prompt. Never their name. */
export function describeMember(m: WorldMember): string {
  const base = m.kind === "person" && m.face ? describeFace(m.face) : "";
  const note = (m.note ?? "").trim();
  if (!base) return note;
  return note ? `${base}, ${note}` : base;
}

/** A blank member of a kind, ready to be filled in. */
export function newMember(kind: WorldKind, name = ""): WorldMember {
  const now = Date.now();
  return { id: crypto.randomUUID(), kind, name, createdAt: now, updatedAt: now };
}

/** Every name this member answers to, lowercased. */
export function namesOf(m: WorldMember): string[] {
  return [m.name, ...(m.aka ?? [])].map((n) => n.trim().toLowerCase()).filter(Boolean);
}
