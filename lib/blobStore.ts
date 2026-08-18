import { get, list, put } from "@vercel/blob";

/**
 * Server-side Blob helpers that adapt to the store's access mode. Vercel Blob
 * stores are created either Public or Private, and every put/get must name the
 * matching mode — so we try "private" first (what our users have), fall back to
 * "public" on an access-mismatch error, and remember whichever worked. Sync
 * content is ciphertext either way; a private store just also hides it from
 * anyone holding a URL.
 */
type AccessMode = "private" | "public";

let knownMode: AccessMode | null = null;

/** The store's read-write token: BLOB_READ_WRITE_TOKEN, or any prefixed
 * <STORE>_BLOB_READ_WRITE_TOKEN a custom connection created. */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const alt = Object.keys(process.env).find(
    (k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && process.env[k],
  );
  return alt ? process.env[alt] : undefined;
}

function accessMismatch(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /access/i.test(msg) && /(private|public)/i.test(msg);
}

function tryOrder(): AccessMode[] {
  return knownMode === "public" ? ["public", "private"] : ["private", "public"];
}

/** Write a JSON string to `path`, matching the store's access mode. */
export async function writeSyncJson(path: string, json: string, token: string): Promise<AccessMode> {
  let lastErr: unknown = null;
  for (const access of tryOrder()) {
    try {
      await put(path, json, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token,
      });
      knownMode = access;
      return access;
    } catch (e) {
      lastErr = e;
      if (!accessMismatch(e)) throw e;
    }
  }
  throw lastErr;
}

/** Read + parse a JSON blob by pathname (or URL); null when it doesn't exist.
 * useCache is off so an overwritten slot never serves a stale CDN copy. */
export async function readSyncJson(urlOrPathname: string, token: string): Promise<unknown | null> {
  let lastErr: unknown = null;
  for (const access of tryOrder()) {
    try {
      const res = await get(urlOrPathname, { access, token, useCache: false });
      if (!res?.stream) return null;
      const text = await new Response(res.stream as ReadableStream).text();
      knownMode = access;
      return JSON.parse(text) as unknown;
    } catch (e) {
      lastErr = e;
      if (!accessMismatch(e)) throw e;
    }
  }
  throw lastErr;
}

/** Every blob under a prefix, as pathname + url pairs. `list` takes no access
 * mode — the token alone identifies the store. */
export async function listPrefix(
  prefix: string,
  token: string,
): Promise<{ pathname: string; url: string }[]> {
  const res = await list({ prefix, limit: 1000, token });
  return res.blobs.map((b) => ({ pathname: b.pathname, url: b.url }));
}
