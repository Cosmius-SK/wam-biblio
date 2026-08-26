"use client";

import { db, getSetting, setSetting, suppressSync } from "./db";
import type { Draft, JournalEntry, Portrait, Reflection } from "./types";
import type { WorldMember } from "./world/types";
import { decryptJSON, encryptJSON, isEncryptedBlob, syncId } from "./crypto";
import { parseRecordPath } from "./syncKeys";

/**
 * Differential (delta) sync. Each entry, portrait, and reflection is its own
 * small encrypted blob at `sync/<id>/<type>/<recordId>.json`; a local ledger
 * (Dexie `syncled`) remembers each record's last content hash + the remote
 * uploadedAt we pulled. Push uploads only records whose content changed and
 * writes tombstones for local deletions; pull fetches only records newer than
 * we've seen. The server only ever sees ciphertext.
 */

/** What's being synced, for a human-readable summary. */
export interface SyncCounts {
  entries: number;
  reflections: number;
  portraits: number;
  photos: number;
}

/** Progress a UI can render: a phase, a % (or null), counts, and x/y items. */
export interface SyncProgress {
  phase: "prepare" | "encrypt" | "upload" | "download" | "merge" | "done";
  percent: number | null;
  counts: SyncCounts;
  item?: { done: number; total: number };
}

export type OnSyncProgress = (p: SyncProgress) => void;

const ZERO: SyncCounts = { entries: 0, reflections: 0, portraits: 0, photos: 0 };
const TOMBSTONE = "__deleted__";

type RecType = "e" | "p" | "r" | "k" | "d" | "w";
interface Rec {
  type: RecType;
  id: string;
  data: unknown;
}

/** The old single-blob snapshot, kept only to seed a fresh device once. */
interface BackupPayload {
  app: "wam-biblio";
  v: 1;
  entries: JournalEntry[];
  reflections: Reflection[];
  portraits?: Portrait[];
  mediaKey?: string;
}

async function hashOf(data: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Adopt an incoming photo key only when this device doesn't have one yet. */
async function adoptMediaKey(incoming?: string): Promise<void> {
  if (!incoming) return;
  const existing = await getSetting("mediaKey");
  if (!existing) await setSetting("mediaKey", incoming);
}

/** Every real (non-demo) record, plus the media key as a pseudo-record. */
async function localRecords(): Promise<Rec[]> {
  const entries = (await db.entries.toArray()).filter((e) => !e.id.startsWith("demo-"));
  const reflections = await db.reflections.toArray();
  const portraits = await db.portraits.toArray();
  const recs: Rec[] = [
    ...entries.map((e) => ({ type: "e" as const, id: e.id, data: e })),
    ...portraits.map((p) => ({ type: "p" as const, id: p.id, data: p })),
    ...reflections.map((r) => ({ type: "r" as const, id: r.id, data: r })),
  ];
  const mediaKey = await getSetting("mediaKey");
  if (mediaKey) recs.push({ type: "k", id: "media", data: { mediaKey } });
  // The in-progress draft travels with everything else, so a thought begun on
  // one device can be finished on another.
  const draft = await db.drafts.get("draft");
  if (draft) recs.push({ type: "d", id: draft.id, data: draft });
  // The cast travels too. biblio is mobile-first but never device-bound, and a
  // world that lived on one phone would be a world you rebuilt on the laptop.
  const world = await db.world.toArray();
  recs.push(...world.map((w) => ({ type: "w" as const, id: w.id, data: w })));
  return recs;
}

function countsFromRecs(recs: Rec[]): SyncCounts {
  const c: SyncCounts = { entries: 0, reflections: 0, portraits: 0, photos: 0 };
  for (const r of recs) {
    if (r.type === "e") {
      c.entries++;
      c.photos += (r.data as JournalEntry).photos?.length ?? 0;
    } else if (r.type === "p") c.portraits++;
    else if (r.type === "r") c.reflections++;
  }
  return c;
}

async function currentCounts(): Promise<SyncCounts> {
  return countsFromRecs(await localRecords());
}

function parsePath(pathname: string): { type: RecType; id: string } | null {
  const hit = parseRecordPath(pathname);
  return hit ? { type: hit.type as RecType, id: hit.id } : null;
}

/** POST one small encrypted record through our own server (which writes it to
 * Blob server-side — reliable, unlike a browser→Blob direct upload). XHR gives
 * real byte progress for the client→server leg, with a 60s timeout so a bad
 * connection errors (and the delta ledger resumes) instead of hanging. */
function postRecord(id: string, key: string, blob: unknown, onByte?: (frac: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/sync");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 60000;
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onByte?.(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let msg = `Sync push failed (${xhr.status}).`;
      try {
        const d = JSON.parse(xhr.responseText) as { error?: string };
        if (d?.error) msg = d.error;
      } catch {
        /* non-JSON error body */
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error during sync."));
    xhr.ontimeout = () => reject(new Error("Sync push timed out — it'll resume on the next sync."));
    xhr.send(JSON.stringify({ id, key, blob }));
  });
}

async function uploadRecord(
  id: string,
  type: RecType,
  recordId: string,
  data: unknown,
  secret: string,
  onByte?: (frac: number) => void,
) {
  const blob = await encryptJSON(data, secret);
  await postRecord(id, `${type}/${recordId}`, blob, onByte);
}

/** Push only the records that changed since the last push; tombstone deletions. */
export async function pushSync(secret: string, onProgress?: OnSyncProgress): Promise<number> {
  onProgress?.({ phase: "prepare", percent: null, counts: ZERO });
  const id = await syncId(secret);
  const recs = await localRecords();
  const counts = countsFromRecs(recs);

  const ledger = new Map((await db.syncled.toArray()).map((r) => [r.key, r]));

  const changed: { rec: Rec; hash: string }[] = [];
  for (const rec of recs) {
    const h = await hashOf(rec.data);
    const prev = ledger.get(rec.id);
    if (!prev || prev.hash !== h) changed.push({ rec, hash: h });
  }
  const localIds = new Set(recs.map((r) => r.id));
  const deletions = [...ledger.values()].filter((l) => l.hash !== TOMBSTONE && !localIds.has(l.key));

  const total = changed.length + deletions.length;
  if (total === 0) {
    onProgress?.({ phase: "done", percent: 100, counts });
    return counts.entries;
  }

  let done = 0;
  const report = (frac: number) =>
    onProgress?.({ phase: "upload", percent: Math.round(((done + frac) / total) * 100), counts, item: { done, total } });
  report(0);

  for (const { rec, hash } of changed) {
    await uploadRecord(id, rec.type, rec.id, rec.data, secret, report);
    const prev = ledger.get(rec.id);
    await db.syncled.put({ key: rec.id, type: rec.type, hash, pulledUp: prev?.pulledUp ?? 0 });
    done++;
    report(0);
  }
  for (const del of deletions) {
    await uploadRecord(id, del.type, del.key, { __deleted: true }, secret, report);
    await db.syncled.put({ key: del.key, type: del.type, hash: TOMBSTONE, pulledUp: del.pulledUp });
    done++;
    report(0);
  }

  onProgress?.({ phase: "done", percent: 100, counts });
  return counts.entries;
}

/**
 * Merge an incoming draft: the most recent edit wins.
 *
 * An earlier version joined both texts on a genuine conflict, so that nothing
 * a person had written could be thrown away. In practice it never settled —
 * each side saw the other's join as a new conflict and joined again, and a
 * draft grew dividers until it stopped syncing at all.
 *
 * So: newest wins, plainly, the way every notes app behaves and nobody is
 * surprised by. The loser is not really lost either — the device that wrote it
 * kept it until this moment, and the words that survive are the ones written
 * last, which is what a person expects.
 */
async function mergeDraft(incoming: Draft, id: string): Promise<void> {
  const local = await db.drafts.get(id);
  if (!local || (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    await db.drafts.put(incoming);
  }
}

/**
 * Merge an incoming cast member: newest edit wins, the same rule as drafts.
 *
 * Two devices adjusting the same face is not a conflict worth agonising over —
 * one of them is later, and later is what a person means by "the one I just
 * changed". Anything cleverer here churns, which is exactly how the drafts
 * merge went wrong.
 */
async function mergeMember(incoming: WorldMember, id: string): Promise<void> {
  const local = await db.world.get(id);
  if (!local || (incoming.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
    await db.world.put(incoming);
  }
}

/** Apply one pulled record (or tombstone) locally and update the ledger. */
async function applyRecord(type: RecType, id: string, data: unknown, uploadedAt: number) {
  const deleted = (data as { __deleted?: boolean })?.__deleted === true;
  await suppressSync(async () => {
    if (deleted) {
      if (type === "e") await db.entries.delete(id);
      else if (type === "p") await db.portraits.delete(id);
      else if (type === "r") await db.reflections.delete(id);
      else if (type === "d") await db.drafts.delete(id);
      else if (type === "w") await db.world.delete(id);
    } else if (type === "e") await db.entries.put(data as JournalEntry);
    else if (type === "p") await db.portraits.put(data as Portrait);
    else if (type === "r") await db.reflections.put(data as Reflection);
    else if (type === "k") await adoptMediaKey((data as { mediaKey?: string }).mediaKey);
    else if (type === "d") await mergeDraft(data as Draft, id);
    else if (type === "w") await mergeMember(data as WorldMember, id);
  });
  // The ledger must describe what is ON DISK, not what arrived. A merged
  // draft differs from the record that triggered the merge, and recording the
  // incoming hash left the two permanently disagreeing — so the device
  // re-pushed every cycle, the other side saw divergence again, and the text
  // grew on each pass instead of settling.
  const stored = !deleted && type === "d" ? await db.drafts.get(id) : null;
  if (!deleted && type === "w") {
    const kept = await db.world.get(id);
    await db.syncled.put({ key: id, type, hash: await hashOf(kept ?? data), pulledUp: uploadedAt });
    return;
  }
  const hash = deleted ? TOMBSTONE : await hashOf(stored ?? data);
  await db.syncled.put({ key: id, type, hash, pulledUp: uploadedAt });
}

/** One-time seed of a fresh device from the legacy single-blob snapshot. */
async function pullMonolith(secret: string): Promise<void> {
  const id = await syncId(secret);
  const res = await fetch(`/api/sync?id=${id}`);
  if (!res.ok) return;
  const data = (await res.json()) as { found?: boolean; blob?: unknown };
  if (!data.found || !isEncryptedBlob(data.blob)) return;
  const payload = await decryptJSON<BackupPayload>(data.blob, secret);
  if (payload.app !== "wam-biblio" || !Array.isArray(payload.entries)) return;
  await suppressSync(async () => {
    await db.entries.bulkPut(payload.entries);
    if (Array.isArray(payload.reflections)) await db.reflections.bulkPut(payload.reflections);
    if (Array.isArray(payload.portraits)) await db.portraits.bulkPut(payload.portraits);
  });
  await adoptMediaKey(payload.mediaKey);
}

/** Pull only records newer than we've seen; apply merges + tombstones. */
export async function pullSync(secret: string, onProgress?: OnSyncProgress): Promise<number> {
  onProgress?.({ phase: "download", percent: null, counts: ZERO });
  const id = await syncId(secret);
  const ledger = new Map((await db.syncled.toArray()).map((r) => [r.key, r]));

  // A fresh device (empty ledger) also seeds from the legacy snapshot, if any.
  if (ledger.size === 0) {
    try {
      await pullMonolith(secret);
    } catch {
      /* none, or unreadable — ignore */
    }
  }

  let items: { pathname: string; uploadedAt: number }[] = [];
  try {
    const res = await fetch(`/api/sync/list?id=${id}`);
    if (res.ok) {
      const d = (await res.json()) as {
        items?: { pathname: string; uploadedAt: string | number }[];
      };
      items = (d.items ?? []).map((i) => ({
        pathname: i.pathname,
        uploadedAt: new Date(i.uploadedAt).getTime(),
      }));
    }
  } catch {
    /* ignore — treat as nothing to pull */
  }

  const changed = items.filter((i) => {
    const parsed = parsePath(i.pathname);
    if (!parsed) return false;
    const prev = ledger.get(parsed.id);
    return !prev || i.uploadedAt > prev.pulledUp;
  });

  const total = changed.length;
  if (total === 0) {
    onProgress?.({ phase: "done", percent: 100, counts: await currentCounts() });
    return 0;
  }

  let done = 0;
  for (const it of changed) {
    onProgress?.({ phase: "download", percent: Math.round((done / total) * 100), counts: ZERO, item: { done, total } });
    const parsed = parsePath(it.pathname);
    if (!parsed) {
      done++;
      continue;
    }
    try {
      // Through our server — a private store's blobs aren't browser-fetchable.
      const r = await fetch(
        `/api/sync/get?id=${id}&key=${parsed.type}/${encodeURIComponent(parsed.id)}`,
        { cache: "no-store" },
      );
      const d = (await r.json()) as { found?: boolean; blob?: unknown };
      if (r.ok && d.found && isEncryptedBlob(d.blob)) {
        const data = await decryptJSON(d.blob, secret);
        await applyRecord(parsed.type, parsed.id, data, it.uploadedAt);
      }
    } catch {
      /* skip this record; a later pull retries it */
    }
    done++;
  }

  onProgress?.({ phase: "done", percent: 100, counts: await currentCounts() });
  return total;
}
