"use client";

import { db, getSetting, setSetting } from "./db";

/**
 * Whether Maya has shown someone around, and how far she got.
 *
 * Progress is device-local (settings never sync), so a second device would
 * ordinarily start the tour again. It doesn't, because a device that pulls
 * down a journal with entries already in it plainly belongs to someone who has
 * been here before — a better signal than any flag, and it needs no new state.
 */
const STEP = "tourStep";
const DONE = "tourDone";

export async function tourDone(): Promise<boolean> {
  return (await getSetting(DONE)) === "1";
}

export async function tourProgress(): Promise<number> {
  return Number(await getSetting(STEP)) || 0;
}

export async function saveTourProgress(index: number): Promise<void> {
  await setSetting(STEP, String(index));
}

export async function finishTour(): Promise<void> {
  await setSetting(DONE, "1");
  await setSetting(STEP, "0");
}

/** Run it again on purpose, from Settings. */
export async function restartTour(): Promise<void> {
  await setSetting(DONE, "0");
  await setSetting(STEP, "0");
}

/**
 * Should the tour run unprompted? Only for someone genuinely new: never seen
 * it, and nothing written yet.
 */
export async function shouldRunTour(): Promise<boolean> {
  if (await tourDone()) return false;
  const written = await db.entries.filter((e) => !e.id.startsWith("demo-")).count();
  return written === 0;
}
