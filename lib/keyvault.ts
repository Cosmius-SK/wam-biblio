"use client";

import { getSetting, setSetting } from "./db";
import {
  decryptJSON,
  encryptJSON,
  generateMediaKey,
  isEncryptedBlob,
  type EncryptedBlob,
} from "./crypto";
import {
  createAppDataFile,
  findAppDataFile,
  readAppDataFile,
  updateAppDataFile,
} from "./drive";
import { deviceId } from "./deviceId";
import { generateRecoveryPhrase, normalizePhrase } from "./recovery";

/**
 * The key vault.
 *
 * `K` is the random key everything in the cloud is encrypted with. It used to
 * sit in Drive's hidden appDataFolder **in plaintext**, which meant that once
 * Google sign-in became the front door, taking someone's Google account took
 * their journal. One factor, not two.
 *
 * So K is never stored directly. It is stored as *envelopes* — the same key
 * encrypted under different secrets. Any envelope you can open yields the same
 * K, which is what makes "forgot my passcode" possible at all without handing
 * out a master key.
 *
 *   wraps.pass      = K sealed with the passcode        (every day)
 *   wraps.recovery  = K sealed with the recovery phrase (the bad day)
 *
 * The migration is the dangerous part and is handled deliberately: the
 * envelopes are written **alongside** the plaintext, never over it, and the
 * plaintext is only dropped once a *different* device has proved it can open
 * one. Every other mistake in this app costs a redeploy; losing K costs the
 * journal.
 */
const SECRET_FILE = "biblio-sync.json";
const CACHE = "googleSyncSecret";

/** Thrown when K exists but only this person's passcode can produce it. */
export const NEEDS_PASSCODE = "BIBLIO_NEEDS_PASSCODE";

export interface KeyWraps {
  pass?: EncryptedBlob;
  recovery?: EncryptedBlob;
}

export interface KeyFile {
  v?: number;
  /** Present only until the envelopes have been proven elsewhere. */
  secret?: string;
  wraps?: KeyWraps;
  createdBy?: string;
  verifiedBy?: string[];
}

/** What shape the account's key is in right now. */
export type KeyState =
  | "none" // nothing in Drive yet
  | "plain" // v1: K in the clear
  | "protected-migrating" // envelopes written, plaintext still there as a net
  | "protected"; // envelopes only

export function stateOf(file: KeyFile | null): KeyState {
  if (!file) return "none";
  const wrapped = !!file.wraps?.pass;
  if (!wrapped) return "plain";
  return file.secret ? "protected-migrating" : "protected";
}

interface Loaded {
  fileId: string | null;
  file: KeyFile | null;
}

export async function loadKeyFile(token: string): Promise<Loaded> {
  const fileId = await findAppDataFile(token, SECRET_FILE);
  if (!fileId) return { fileId: null, file: null };
  const file = await readAppDataFile<KeyFile>(token, fileId);
  return { fileId, file: file ?? null };
}

async function save(token: string, fileId: string | null, file: KeyFile): Promise<string> {
  if (fileId) {
    await updateAppDataFile(token, fileId, file);
    return fileId;
  }
  return createAppDataFile(token, SECRET_FILE, file);
}

export async function cachedKey(): Promise<string | null> {
  return (await getSetting(CACHE)) || null;
}

async function cache(secret: string): Promise<void> {
  await setSetting(CACHE, secret);
}

async function wrap(secret: string, passcode: string, phrase: string): Promise<KeyWraps> {
  return {
    pass: await encryptJSON({ secret }, passcode),
    recovery: await encryptJSON({ secret }, normalizePhrase(phrase)),
  };
}

async function openWith(blob: EncryptedBlob | undefined, phrase: string): Promise<string | null> {
  if (!isEncryptedBlob(blob)) return null;
  try {
    const { secret } = await decryptJSON<{ secret?: string }>(blob, phrase);
    return secret ?? null;
  } catch {
    // AES-GCM authenticates, so a wrong passcode fails cleanly here. That is
    // also why no passcode hash is stored anywhere: being right proves itself.
    return null;
  }
}

/**
 * Record that this device opened an envelope, and retire the plaintext once a
 * device that did NOT write the envelopes has proved it can open one.
 *
 * That proof is the whole safety net. Until it exists, the plaintext stays.
 */
async function noteVerified(token: string, fileId: string, file: KeyFile): Promise<void> {
  const me = deviceId();
  const verified = new Set(file.verifiedBy ?? []);
  const already = verified.has(me);
  verified.add(me);
  const provenElsewhere = [...verified].some((d) => d !== file.createdBy);
  if (already && !(file.secret && provenElsewhere)) return;
  const next: KeyFile = { ...file, verifiedBy: [...verified] };
  if (provenElsewhere) delete next.secret;
  try {
    await save(token, fileId, next);
  } catch {
    /* bookkeeping — never fail an unlock over it */
  }
}

/**
 * K without asking anyone anything. Returns null when only a passcode can
 * produce it, so callers can decide whether this is the moment to ask.
 */
export async function silentKey(token: string): Promise<string | null> {
  const cached = await cachedKey();
  if (cached) return cached;
  const { fileId, file } = await loadKeyFile(token);

  if (!file) {
    // First device on this account: mint K. It is written in the clear until a
    // passcode exists to seal it — protection arrives with the passcode, and
    // the alternative is refusing to work at all until someone sets one.
    const secret = generateMediaKey();
    await save(token, null, { v: 2, secret, verifiedBy: [deviceId()] });
    await cache(secret);
    return secret;
  }

  if (file.secret) {
    await cache(file.secret);
    if (fileId) void noteVerified(token, fileId, file);
    return file.secret;
  }
  return null; // sealed — a passcode or the recovery phrase is required
}

/** Try a passcode (or recovery phrase) against the envelopes. */
export async function unlockWithSecret(token: string, phrase: string): Promise<string | null> {
  const { fileId, file } = await loadKeyFile(token);
  if (!file || !fileId) return null;
  const secret =
    (await openWith(file.wraps?.pass, phrase)) ??
    (await openWith(file.wraps?.recovery, normalizePhrase(phrase)));
  if (!secret) return null;
  await cache(secret);
  await noteVerified(token, fileId, file);
  return secret;
}

/**
 * Seal K with a passcode and hand back a freshly minted recovery phrase.
 *
 * Used both to protect a journal for the first time and to change a passcode
 * later. The phrase is always new: an old one has just been typed into a
 * screen someone may have been standing behind.
 */
export async function setPasscode(token: string, passcode: string): Promise<string> {
  const secret = await silentKey(token);
  if (!secret) throw new Error(NEEDS_PASSCODE);
  const { fileId, file } = await loadKeyFile(token);
  const phrase = generateRecoveryPhrase();
  const next: KeyFile = {
    ...(file ?? {}),
    v: 2,
    secret, // stays until another device proves it can open an envelope
    wraps: await wrap(secret, passcode, phrase),
    createdBy: deviceId(),
    verifiedBy: [deviceId()],
  };
  await save(token, fileId, next);
  await cache(secret);
  return phrase;
}

/** Whether this browser can already open the journal without being asked. */
export async function isUnlockedHere(): Promise<boolean> {
  return !!(await cachedKey());
}
