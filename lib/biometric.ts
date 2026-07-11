"use client";

import { getSetting, setSetting } from "./db";

/**
 * Biometric app lock (Pass 2): a WebAuthn platform credential (Face ID /
 * fingerprint) gates opening the app on THIS device. With no backend to verify
 * assertions (that's Option C), this is a device-bound presence check — the
 * right scope for a local lock — and the server passcode remains the fallback,
 * so biometrics can never lock the owner out.
 *
 * Only the credential's id is stored (settings); localStorage carries a
 * synchronous "lock is on" hint and sessionStorage the "unlocked this session"
 * flag, so locking works before IndexedDB wakes up.
 */
const LS_FLAG = "biblio_bio";
const SS_OK = "biblio_bio_ok";

// TS 5.7's generic typed arrays don't always unify with the DOM's BufferSource.
const bs = (u: Uint8Array): BufferSource => u as BufferSource;

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** True when this device has a user-verifying platform authenticator. */
export async function biometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await getSetting("bioEnabled")) === "1";
}

/** Register the device authenticator and turn the lock on (from a tap). */
export async function enrollBiometric(): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: bs(crypto.getRandomValues(new Uint8Array(32))),
      rp: { name: "biblio" },
      user: {
        id: bs(crypto.getRandomValues(new Uint8Array(16))),
        name: "biblio journal",
        displayName: "biblio journal",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No credential was created.");
  await setSetting("bioCredId", toB64(cred.rawId));
  await setSetting("bioEnabled", "1");
  try {
    localStorage.setItem(LS_FLAG, "1");
    sessionStorage.setItem(SS_OK, "1"); // the owner is clearly present right now
  } catch {
    /* private mode */
  }
}

/** Prompt Face ID / fingerprint; true (and session-unlocked) on success. */
export async function verifyBiometric(): Promise<boolean> {
  const credId = await getSetting("bioCredId");
  if (!credId) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: bs(crypto.getRandomValues(new Uint8Array(32))),
        allowCredentials: [{ type: "public-key", id: bs(fromB64(credId)), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (assertion) {
      markUnlocked();
      return true;
    }
  } catch {
    /* cancelled or failed — the overlay offers retry + passcode fallback */
  }
  return false;
}

export async function disableBiometric(): Promise<void> {
  await setSetting("bioEnabled", "0");
  await setSetting("bioCredId", "");
  try {
    localStorage.removeItem(LS_FLAG);
  } catch {
    /* ignore */
  }
}

/** Synchronous hint (usable before IndexedDB wakes) that the lock is on. */
export function lockHintOn(): boolean {
  try {
    return localStorage.getItem(LS_FLAG) === "1";
  } catch {
    return false;
  }
}

export function sessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SS_OK) === "1";
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(SS_OK, "1");
  } catch {
    /* ignore */
  }
}

export function relock(): void {
  try {
    sessionStorage.removeItem(SS_OK);
  } catch {
    /* ignore */
  }
}
