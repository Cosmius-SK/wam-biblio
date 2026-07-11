"use client";

import { upload } from "@vercel/blob/client";
import { db, getSetting, setSetting, suppressSync } from "./db";
import type { JournalEntry, Portrait, Reflection } from "./types";
import { encryptJSON, decryptJSON, isEncryptedBlob, syncId } from "./crypto";

/**
 * The encrypted sync payload and its push/pull. Shared by the manual passphrase
 * vault and the automatic Google-account sync — the only difference is where
 * the `secret` comes from (a typed passphrase vs a key kept in Drive appData).
 * Both encrypt client-side; the server only ever sees ciphertext.
 */
export interface BackupPayload {
  app: "wam-biblio";
  v: 1;
  exportedAt: number;
  entries: JournalEntry[];
  reflections: Reflection[];
  portraits?: Portrait[];
  mediaKey?: string;
}

/** Adopt an incoming photo key only when this device doesn't have one yet. */
async function adoptMediaKey(incoming?: string): Promise<void> {
  if (!incoming) return;
  const existing = await getSetting("mediaKey");
  if (!existing) await setSetting("mediaKey", incoming);
}

/** Gather the real (non-demo) local journal into a payload. */
export async function buildPayload(): Promise<BackupPayload> {
  const entries = (await db.entries.toArray()).filter((e) => !e.id.startsWith("demo-"));
  const reflections = await db.reflections.toArray();
  const portraits = await db.portraits.toArray();
  return {
    app: "wam-biblio",
    v: 1,
    exportedAt: Date.now(),
    entries,
    reflections,
    portraits,
    mediaKey: await getSetting("mediaKey"),
  };
}

function isEmpty(p: BackupPayload): boolean {
  return p.entries.length === 0 && p.reflections.length === 0 && (p.portraits?.length ?? 0) === 0;
}

/**
 * Encrypt the local journal under `secret` and push it to the cloud slot.
 * Uploads the ciphertext DIRECTLY to Vercel Blob (via a short-lived authorized
 * token) so a large journal — photo/portrait thumbnails, illustrations — isn't
 * capped by the serverless request-body limit.
 */
export async function pushSync(secret: string): Promise<number> {
  const payload = await buildPayload();
  if (isEmpty(payload)) return 0;
  const blob = await encryptJSON(payload, secret);
  const id = await syncId(secret);
  try {
    await upload(`sync/${id}.json`, JSON.stringify(blob), {
      access: "public",
      contentType: "application/json",
      handleUploadUrl: "/api/sync/upload",
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Sync push failed.");
  }
  return payload.entries.length;
}

/** Pull the cloud slot for `secret`, decrypt, and merge into the local store. */
export async function pullSync(secret: string): Promise<number> {
  const id = await syncId(secret);
  const res = await fetch(`/api/sync?id=${id}`);
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "Sync pull failed.");
  }
  const data = (await res.json()) as { found?: boolean; blob?: unknown };
  if (!data.found || !isEncryptedBlob(data.blob)) return 0;
  const payload = await decryptJSON<BackupPayload>(data.blob, secret);
  if (payload.app !== "wam-biblio" || !Array.isArray(payload.entries)) {
    throw new Error("This sync payload is missing its journal data.");
  }
  // Merge without re-triggering an auto-push of what we just pulled.
  await suppressSync(async () => {
    await db.entries.bulkPut(payload.entries);
    if (Array.isArray(payload.reflections)) await db.reflections.bulkPut(payload.reflections);
    if (Array.isArray(payload.portraits)) await db.portraits.bulkPut(payload.portraits);
  });
  await adoptMediaKey(payload.mediaKey);
  return payload.entries.length;
}
