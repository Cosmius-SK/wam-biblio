"use client";

import { db, getSetting, setSetting } from "./db";
import {
  NEEDS_PASSCODE,
  loadKeyFile,
  setPasscode,
  silentKey,
  stateOf,
  unlockWithSecret,
  type KeyState,
} from "./keyvault";
import { clearCachedToken, driveConfigured, getAccessToken, getIdentity } from "./drive";
import { pullSync, pushSync, type OnSyncProgress } from "./sync";
import { describeDevice } from "./deviceId";

/**
 * Google-account sync (Option B). Signing in recovers — or creates — a random
 * sync secret kept in the account's hidden Drive appDataFolder, then reuses the
 * ordinary encrypted sync pipeline with that secret. So a second device signs
 * in and its journal reassembles itself, no passphrase to remember.
 */
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

/**
 * The account's sync key, without asking anyone anything.
 *
 * Throws NEEDS_PASSCODE when the key is sealed and only the passcode (or the
 * recovery phrase) can open it — the caller decides whether this is a moment
 * to interrupt someone. See lib/keyvault.ts.
 */
async function ensureSecret(token: string): Promise<string> {
  const secret = await silentKey(token);
  if (!secret) throw new Error(NEEDS_PASSCODE);
  return secret;
}

/**
 * Is this journal sealed, in the clear, or mid-migration?
 *
 * "unknown" means we could not find out — usually because a silent token
 * refresh needs the user present. It must never be treated as "unsealed":
 * telling someone their journal is unprotected when we simply could not look
 * would invite them to re-seal it, which mints a new recovery phrase and
 * quietly invalidates the one they wrote down.
 */
export async function keyState(interactive = false): Promise<KeyState | "unknown"> {
  try {
    const token = await getAccessToken(interactive);
    const { file } = await loadKeyFile(token);
    return stateOf(file);
  } catch {
    return "unknown";
  }
}

/** Seal the journal with a passcode; returns the new recovery phrase. */
export async function protectWithPasscode(passcode: string): Promise<string> {
  const token = await getAccessToken(true);
  return setPasscode(token, passcode);
}

/** Open a sealed journal on this device with a passcode or recovery phrase. */
export async function unlockHere(phrase: string): Promise<boolean> {
  const token = await getAccessToken(true);
  const secret = await unlockWithSecret(token, phrase);
  return !!secret;
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
  return completeSignIn(token, onProgress);
}

/**
 * Everything that has to happen on *this device* once a Google token exists.
 *
 * Kept separate because there are two ways in now. The account card fetches a
 * token and calls this; the front door already has one from `/api/auth/session`
 * and calls this too. When the door skipped it, an invited person got a session
 * cookie and nothing else — no profile, no sync key, no Drive — so biblio
 * greeted them by name nowhere, synced nothing, and still offered them a
 * "Sign in with Google" button they had already used.
 */
export async function completeSignIn(
  token: string,
  onProgress?: OnSyncProgress,
): Promise<{ profile: Profile; syncError: string | null }> {
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
    const message = e instanceof Error ? e.message : "Sync couldn't start yet.";
    syncError =
      message === NEEDS_PASSCODE
        ? "This journal is protected by a passcode — enter it in Settings › Security to open it here."
        : message;
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    throw new Error(
      message === NEEDS_PASSCODE
        ? "This journal is protected by a passcode — enter it in Settings › Security to open it here."
        : "This device hasn't finished sync setup — its key is missing. Sign out and sign in again to link it.",
    );
  }
  await pullSync(secret, onProgress);
  await pushSync(secret, onProgress);
  await setSetting("lastSyncAt", String(Date.now()));
}
