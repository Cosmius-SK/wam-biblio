"use client";

import { getSetting, setSetting } from "./db";
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
import { pullSync, pushSync } from "./sync";

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

/** The cached sync secret for this device, or null if not connected. */
async function syncSecret(): Promise<string | null> {
  return (await getSetting("googleSyncSecret")) || null;
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
 * Interactive sign-in: fresh consent (for the broadened scopes), read the
 * profile, recover/create the sync secret, then pull cloud → push local so both
 * ends merge. Returns the profile; throws with a friendly message on failure.
 */
export async function signInWithGoogle(): Promise<Profile> {
  clearCachedToken(); // force consent so the new scopes are actually granted
  const token = await getAccessToken(true);
  const id = await getIdentity(token);
  const profile: Profile = { sub: id.sub, email: id.email, name: id.name, picture: id.picture };
  await setSetting("googleProfile", JSON.stringify(profile));
  await setSetting("googleConnected", "1");
  await setSetting("driveConnected", "1"); // photos work under the same grant
  if (id.name && !(await getSetting("displayName"))) await setSetting("displayName", id.name);

  const secret = await ensureSecret(token);
  await pullSync(secret);
  await pushSync(secret);
  await setSetting("lastSyncAt", String(Date.now()));
  return profile;
}

/** Forget the account on this device (keeps the Drive key file for re-sign-in). */
export async function signOutGoogle(): Promise<void> {
  await setSetting("googleConnected", "0");
  await setSetting("googleProfile", "");
  await setSetting("googleSyncSecret", "");
  clearCachedToken();
}

/** Pull cloud → local (called on app open when connected). */
export async function autoPull(): Promise<void> {
  const secret = await syncSecret();
  if (!secret) return;
  await pullSync(secret);
  await setSetting("lastSyncAt", String(Date.now()));
}

/** Push local → cloud (called debounced after changes, and by "Sync now"). */
export async function syncNow(): Promise<void> {
  const secret = await syncSecret();
  if (!secret) return;
  await pushSync(secret);
  await setSetting("lastSyncAt", String(Date.now()));
}
