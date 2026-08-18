"use client";

import { db, getSetting, setSetting } from "./db";
import { generateMediaKey } from "./crypto";
import {
  clearCachedToken,
  createAppDataFile,
  driveConfigured,
  findAppDataFile,
  getAccessToken,
  getIdentity,
  readAppDataFile,
} from "./drive";
import { pullSync, pushSync, type OnSyncProgress } from "./sync";
import { describeDevice } from "./deviceId";

/**
 * Google-account sync (Option B). Signing in recovers — or creates — a random
 * sync secret kept in the account's hidden Drive appDataFolder, then reuses the
 * ordinary encrypted sync pipeline with that secret. So a second device signs
 * in and its journal reassembles itself, no passphrase to remember.
 */
const SECRET_FILE = "biblio-sync.json";

export interface Profile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export function googleConfigured(): boolean {
  return driveConfigured();
}

export async function isGoogleConnected(): Promise<boolean> {
  return (await getSetting("googleConnected")) === "1";
}

export async function getProfile(): Promise<Profile | null> {
  const raw = await getSetting("googleProfile");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function lastSyncedAt(): Promise<number | null> {
  const v = await getSetting("lastSyncAt");
  return v ? Number(v) : null;
}

/**
 * Tell the server who just signed in, so it can issue a session cookie and
 * register this device. Best effort on purpose: while both doors are open, a
 * closed or unconfigured session door must never break sync sign-in.
 */
async function openSessionDoor(token: string): Promise<void> {
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device: describeDevice() }),
    });
  } catch {
    /* the passcode door is still there */
  }
}

/** Recover the account's sync secret from appDataFolder, or mint + store one. */
async function ensureSecret(token: string): Promise<string> {
  const cached = await getSetting("googleSyncSecret");
  if (cached) return cached;
  const fileId = await findAppDataFile(token, SECRET_FILE);
  if (fileId) {
    const content = await readAppDataFile<{ secret?: string }>(token, fileId);
    if (content?.secret) {
      await setSetting("googleSyncSecret", content.secret);
      return content.secret;
    }
  }
  const secret = generateMediaKey(); // random 256-bit, base64
  await createAppDataFile(token, SECRET_FILE, { secret });
  await setSetting("googleSyncSecret", secret);
  return secret;
}

/**
 * The sync secret, healing the signed-in-without-a-key state: if this device
 * missed the key at sign-in (e.g. the appData read failed that day), fetch a
 * token — silently, or interactively when the user just tapped — and recover
 * the key from Drive. Throws when recovery isn't possible right now.
 */
async function requireSecret(interactive: boolean): Promise<string> {
  const cached = await getSetting("googleSyncSecret");
  if (cached) return cached;
  const token = await getAccessToken(interactive);
  return ensureSecret(token);
}

/**
 * Interactive sign-in: fresh consent (for the broadened scopes), read the
 * profile, recover/create the sync secret, then pull cloud → push local so both
 * ends merge. Returns the profile; throws with a friendly message on failure.
 */
export async function signInWithGoogle(
  onProgress?: OnSyncProgress,
): Promise<{ profile: Profile; syncError: string | null }> {
  clearCachedToken(); // force consent so the new scopes are actually granted
  const token = await getAccessToken(true);
  const id = await getIdentity(token);
  const profile: Profile = { sub: id.sub, email: id.email, name: id.name, picture: id.picture };
  await setSetting("googleProfile", JSON.stringify(profile));
  await setSetting("googleConnected", "1");
  await setSetting("driveConnected", "1"); // photos work under the same grant
  if (id.name && !(await getSetting("displayName"))) await setSetting("displayName", id.name);
  await openSessionDoor(token);

  // Sign-in has succeeded here. Key recovery and the first sync can still fail
  // (e.g. no Blob store yet, or a transient Drive error) without undoing the
  // connection — the account stays signed in, the error is surfaced, and both
  // autoPull and Sync now heal the missing key on their next run.
  let syncError: string | null = null;
  try {
    const secret = await ensureSecret(token);
    await pullSync(secret, onProgress);
    await pushSync(secret, onProgress);
    await setSetting("lastSyncAt", String(Date.now()));
  } catch (e) {
    syncError = e instanceof Error ? e.message : "Sync couldn't start yet.";
  }
  return { profile, syncError };
}

/** Forget the account on this device (keeps the Drive key file for re-sign-in). */
export async function signOutGoogle(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    /* the cookie will expire on its own */
  }
  await setSetting("googleConnected", "0");
  await setSetting("googleProfile", "");
  await setSetting("googleSyncSecret", "");
  // Clear the delta ledger so a different account re-syncs cleanly here.
  await db.syncled.clear();
  clearCachedToken();
}

/** Pull cloud → local on app open — recovering the key silently if missing. */
export async function autoPull(onProgress?: OnSyncProgress): Promise<void> {
  if (!(await isGoogleConnected())) return;
  let secret: string;
  try {
    secret = await requireSecret(false);
  } catch {
    return; // background path — Sync now offers the interactive recovery
  }
  await pullSync(secret, onProgress);
  await setSetting("lastSyncAt", String(Date.now()));
}

/** Push local → cloud, debounced after changes (background, never prompts). */
export async function autoPush(): Promise<void> {
  if (!(await isGoogleConnected())) return;
  let secret: string;
  try {
    secret = await requireSecret(false);
  } catch {
    return;
  }
  await pushSync(secret);
  await setSetting("lastSyncAt", String(Date.now()));
}

/** User-initiated Sync now: converge BOTH ways — pull, then push. May prompt
 * to recover the key, since it runs from a real tap. */
export async function syncNow(onProgress?: OnSyncProgress): Promise<void> {
  let secret: string;
  try {
    secret = await requireSecret(true);
  } catch {
    throw new Error(
      "This device hasn't finished sync setup — its key is missing. Sign out and sign in again to link it.",
    );
  }
  await pullSync(secret, onProgress);
  await pushSync(secret, onProgress);
  await setSetting("lastSyncAt", String(Date.now()));
}
