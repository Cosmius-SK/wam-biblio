"use client";

import { db, getSetting, setSetting } from "./db";
import { describeDevice } from "./deviceId";

/**
 * Maya listening back.
 *
 * The one place in biblio where someone deliberately writes **to** a person
 * rather than to themselves. That distinction carries the whole trust of the
 * app, so it is drawn everywhere it appears — in the words, the colour, and
 * what is actually sent.
 *
 * She asks rarely, one question at a time, and never asks the same one twice.
 * Three moments over a fortnight is a conversation; anything more is a survey.
 */
export interface Prompt {
  id: string;
  question: string;
  /** Days after the first entry before this becomes due. */
  after: number;
}

export const PROMPTS: Prompt[] = [
  {
    id: "first-entry",
    question: "You've written your first one. How did that feel?",
    after: 0,
  },
  {
    id: "day-3",
    question: "A few days in — has anything felt awkward, or got in your way?",
    after: 3,
  },
  {
    id: "week-2",
    question: "Two weeks now. Honestly: is this worth keeping?",
    after: 14,
  },
];

const ASKED = (id: string) => `askedFeedback:${id}`;

async function firstEntryAt(): Promise<number | null> {
  const entries = await db.entries.filter((e) => !e.id.startsWith("demo-")).toArray();
  if (entries.length === 0) return null;
  return Math.min(...entries.map((e) => e.recordedAt ?? e.createdAt));
}

/** The one question that is due now, if any. Never more than one. */
export async function duePrompt(): Promise<Prompt | null> {
  const start = await firstEntryAt();
  if (start === null) return null;
  const days = (Date.now() - start) / 86_400_000;
  for (const p of PROMPTS) {
    if (days < p.after) continue;
    if ((await getSetting(ASKED(p.id))) === "1") continue;
    return p;
  }
  return null;
}

/** Asked once, ever — whether or not they answered. */
export async function markAsked(id: string): Promise<void> {
  await setSetting(ASKED(id), "1");
}

export interface Outgoing {
  message: string;
  prompt?: string;
  /** Included only when they leave the box ticked, and shown to them first. */
  context?: { version: string; device: string };
}

export function contextNow(): { version: string; device: string } {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    device: describeDevice().label,
  };
}

export async function sendFeedback(body: Outgoing): Promise<void> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "That didn't send. Try again in a moment?");
  }
}
