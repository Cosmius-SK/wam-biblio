/**
 * Client-side end-to-end encryption for backups (Phase 4).
 *
 * A passphrase you choose derives an AES-GCM key via PBKDF2 (Web Crypto). The
 * passphrase is never stored or sent anywhere — only the encrypted envelope
 * leaves the device. Lose the passphrase and the backup can't be opened; that
 * is the point.
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();
const ITERATIONS = 210_000;

// TS 5.7's generic typed arrays don't always unify with the DOM's BufferSource;
// normalize at the Web Crypto boundary.
const bs = (u: Uint8Array): BufferSource => u as BufferSource;

export interface EncryptedBlob {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
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

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bs(ENC.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"] as KeyUsage[],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"] as KeyUsage[],
  );
}

export async function encryptJSON(obj: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bs(iv) },
    key,
    bs(ENC.encode(JSON.stringify(obj))),
  );
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(cipher),
  };
}

export async function decryptJSON<T = unknown>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const key = await deriveKey(passphrase, fromB64(blob.salt), blob.iter || ITERATIONS);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(fromB64(blob.iv)) },
    key,
    bs(fromB64(blob.data)),
  );
  return JSON.parse(DEC.decode(plain)) as T;
}

/** Quick shape check so we can give a clean error on a non-backup file. */
export function isEncryptedBlob(x: unknown): x is EncryptedBlob {
  const b = x as Partial<EncryptedBlob>;
  return !!b && b.v === 1 && typeof b.salt === "string" && typeof b.iv === "string" && typeof b.data === "string";
}

/**
 * A stable, unguessable cloud location derived from the passphrase. Two devices
 * with the same passphrase resolve to the same sync slot — and only ciphertext
 * is ever stored there.
 */
export async function syncId(passphrase: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bs(ENC.encode("biblio-sync:" + passphrase)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}
