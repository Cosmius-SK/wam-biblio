"use client";

import { db, notifyDataChanged } from "./db";
import { encryptJSON, syncId } from "./crypto";
import { cachedKey } from "./keyvault";
import { deletePhotos } from "./media";
import { autoPush } from "./googleAccount";
import type { Draft, EntryPhoto, EntryPlace } from "./types";

/**
 * The single in-progress capture.
 *
 * One draft, not a list — a journal with a pile of half-thoughts becomes a pile
 * of guilt. It saves at typing speed locally and is pushed to the cloud only at
 * the quiet moments, because the words are what must never be lost and the
 * network is not what makes that true.
 *
 * It syncs (see lib/sync.ts, record type "d") so a thought begun on a phone can
 * be finished on a laptop. Photos are already uploaded by the time they reach a
 * draft, so they travel as references and cost nothing to carry.
 */
const ID = "draft" as const;
/** Synchronous hint, readable before IndexedDB wakes — for the header dot. */
const LS_HINT = "biblio_draft";
const SAVE_MS = 800;
/** Long enough that typing never triggers an upload; short enough to be safe. */
const PUSH_MS = 30_000;
/** Past this, a draft is offered rather than silently restored. */
export const STALE_MS = 7 * 24 * 60 * 60_000;

export type DraftInput = Omit<Draft, "id" | "updatedAt">;

let saveTimer: number | null = null;
let pushTimer: number | null = null;
let pending: DraftInput | null = null;
let listening = false;

function setHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(LS_HINT, "1");
    else localStorage.removeItem(LS_HINT);
  } catch {
    /* private mode */
  }
}

/** Cheap synchronous "there is something waiting" check. */
export function draftHint(): boolean {
  try {
    return localStorage.getItem(LS_HINT) === "1";
  } catch {
    return false;
  }
}

export function isBlankDraft(d: DraftInput | Draft): boolean {
  return d.text.trim().length === 0 && d.photos.length === 0;
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const d = (await db.drafts.get(ID)) ?? null;
    setHint(!!d && !isBlankDraft(d));
    return d && !isBlankDraft(d) ? d : null;
  } catch {
    return null;
  }
}

async function write(input: DraftInput): Promise<void> {
  if (isBlankDraft(input)) {
    await removeRow();
    return;
  }
  await db.drafts.put({ ...input, id: ID, updatedAt: Date.now() });
  setHint(true);
  // Get the escape route ready while there is still time to prepare it.
  void prepareBeacon();
}

async function removeRow(): Promise<void> {
  // Deleting the row is enough: the sync ledger turns a missing local record
  // into a tombstone on the next push, so the other device loses it too.
  await db.drafts.delete(ID);
  setHint(false);
  beacon = null;
}

/**
 * A pre-encrypted copy of the draft, ready to leave without any async work.
 *
 * A phone freezes the page the moment it is backgrounded, so a debounced
 * upload — or any upload started at that instant — is simply killed. That is
 * why a draft written on a phone reached nothing, while one written on a
 * laptop arrived: the laptop kept running long enough to finish.
 *
 * `sendBeacon` exists for exactly this and survives the freeze, but it cannot
 * await encryption, so the ciphertext is prepared in advance each time the
 * draft is saved.
 */
let beacon: string | null = null;
/** Beacons are refused above roughly 64KB; a draft carrying photo thumbnails
 * can exceed that, and those fall back to the ordinary push. */
const BEACON_MAX = 50_000;

async function prepareBeacon(): Promise<void> {
  try {
    const draft = await db.drafts.get(ID);
    const secret = await cachedKey();
    if (!draft || !secret) {
      beacon = null;
      return;
    }
    const body = JSON.stringify({
      id: await syncId(secret),
      key: "d/draft",
      blob: await encryptJSON(draft, secret),
    });
    beacon = body.length <= BEACON_MAX ? body : null;
  } catch {
    beacon = null;
  }
}

/** Fire the prepared copy. Returns whether anything was sent. */
function sendBeaconNow(): boolean {
  if (!beacon || typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  try {
    return navigator.sendBeacon("/api/sync", new Blob([beacon], { type: "application/json" }));
  } catch {
    return false;
  }
}

function ensureListeners(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  // The reliable one. `beforeunload` is not dependable in an installed PWA,
  // and this is exactly the "put the phone down" moment.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    sendBeaconNow();
    void flushDraft(true);
  });
  window.addEventListener("pagehide", () => {
    sendBeaconNow();
    void flushDraft(true);
  });
}

/** Save at typing speed. Cheap, local, debounced. */
export function queueDraftSave(input: DraftInput): void {
  ensureListeners();
  pending = input;
  setHint(!isBlankDraft(input));
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flushDraft(false), SAVE_MS);
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void flushDraft(true), PUSH_MS);
}

/** Write anything outstanding. `push` also asks auto-sync to carry it up. */
export async function flushDraft(push = false): Promise<void> {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  const input = pending;
  pending = null;
  if (input) {
    try {
      await write(input);
    } catch {
      /* nothing here is worth interrupting someone mid-sentence for */
    }
  }
  if (push) {
    if (pushTimer) {
      window.clearTimeout(pushTimer);
      pushTimer = null;
    }
    // Straight out, not through the four-second debounce the rest of the app
    // uses. A phone freezes a backgrounded page within a moment, and those
    // four seconds were long enough for the upload never to start — which is
    // why a draft written on a phone stayed on the phone.
    notifyDataChanged();
    try {
      await autoPush();
    } catch {
      /* the beacon and the next visit both still carry it */
    }
  }
}

/**
 * The draft became an entry. The photos now belong to that entry, so they stay
 * in Drive — only the draft row goes.
 */
export async function clearDraft(): Promise<void> {
  pending = null;
  if (saveTimer) window.clearTimeout(saveTimer);
  if (pushTimer) window.clearTimeout(pushTimer);
  saveTimer = pushTimer = null;
  await removeRow();
  notifyDataChanged();
}

/**
 * They decided it was not worth writing. Nothing else will ever reference these
 * photos, so they are removed from Drive too — best effort, because failing to
 * tidy up must never block someone from starting fresh.
 */
export async function discardDraft(photos: EntryPhoto[] = []): Promise<void> {
  pending = null;
  if (saveTimer) window.clearTimeout(saveTimer);
  if (pushTimer) window.clearTimeout(pushTimer);
  saveTimer = pushTimer = null;
  const existing = photos.length ? photos : ((await db.drafts.get(ID))?.photos ?? []);
  await removeRow();
  notifyDataChanged();
  if (existing.length) void deletePhotos(existing);
}

/** Convenience for callers assembling a draft from composer state. */
export function draftFrom(
  text: string,
  aiMode: Draft["aiMode"],
  illustrate: boolean,
  when: string,
  place: EntryPlace | null,
  photos: EntryPhoto[],
): DraftInput {
  return { text, aiMode, illustrate, when, place: place ?? undefined, photos };
}

/**
 * Whether the draft on this device has reached the cloud yet.
 *
 * Sync is silent by design, which is right until something is wrong — and then
 * there is nothing to look at and every report is a symptom. This is the one
 * honest signal: the sync ledger's record of what was last pushed, compared
 * with what is on disk now.
 */
export type DraftSync = "none" | "pending" | "synced" | "offline";

export async function draftSyncState(): Promise<DraftSync> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    const draft = await db.drafts.get(ID);
    if (!draft) return "none";
    const led = await db.syncled.get(ID);
    if (!led) return "pending";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(draft)),
    );
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return led.hash === hash ? "synced" : "pending";
  } catch {
    return "pending";
  }
}
