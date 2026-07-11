"use client";

import { getSetting, setSetting } from "./db";

/**
 * Google Drive integration for photo attachments — entirely client-side.
 *
 * Auth uses Google Identity Services (token flow, no client secret, no server
 * involvement) with the `drive.file` scope: the app can only see files it
 * created, never the rest of the Drive. Uploads/downloads are encrypted blobs
 * (see lib/media.ts) inside a "biblio-journal" folder the app creates.
 */
// drive.file: app-created media. drive.appdata: a hidden app-only folder that
// holds the sync key. openid/email/profile: identity for the account UI.
const SCOPE = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");
const FOLDER_NAME = "biblio-journal";
const TOKEN_KEY = "biblio_drive_token";
const APPDATA = "appDataFolder";

/** Sentinel error message: the user needs to (re)connect interactively. */
export const RECONNECT = "DRIVE_RECONNECT";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenError {
  type?: string;
  message?: string;
}
interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: TokenError) => void;
  requestAccessToken: (cfg?: { prompt?: string }) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: TokenError) => void;
  }) => TokenClient;
}

let tokenClient: TokenClient | null = null;
let gisLoading: Promise<void> | null = null;

export function driveClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

/** True when a Google OAuth client id is configured on the deployment. */
export function driveConfigured(): boolean {
  return driveClientId().length > 0;
}

/** True when this device has been connected to Drive by the user. */
export async function isDriveConnected(): Promise<boolean> {
  return driveConfigured() && (await getSetting("driveConnected")) === "1";
}

function oauth2(): GoogleOAuth2 | null {
  const w = window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } };
  return w.google?.accounts?.oauth2 ?? null;
}

function loadGis(): Promise<void> {
  if (oauth2()) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Couldn't load Google sign-in."));
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

function cachedToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: string; exp?: number };
    if (parsed.t && parsed.exp && parsed.exp > Date.now()) return parsed.t;
  } catch {
    /* unreadable cache */
  }
  return null;
}

/**
 * Get a Drive access token. Non-interactive calls attempt a silent refresh
 * and reject with RECONNECT when Google wants the user present; interactive
 * calls (from the vault's Connect button) may show the Google popup.
 */
export async function getAccessToken(interactive: boolean): Promise<string> {
  if (!driveConfigured()) throw new Error(RECONNECT);
  const cached = cachedToken();
  if (cached) return cached;
  await loadGis();
  const o = oauth2();
  if (!o) throw new Error("Google sign-in didn't load.");
  return new Promise<string>((resolve, reject) => {
    // A single settle guard: GIS can fire callback, error_callback, throw, or —
    // on a silent refresh it can't complete — go quiet. Any of these must
    // resolve or reject exactly once, so the caller never hangs.
    let settled = false;
    const fail = () =>
      !settled &&
      ((settled = true), reject(new Error(interactive ? "Google auth failed." : RECONNECT)));

    const callback = (r: TokenResponse) => {
      if (settled) return;
      if (!r.access_token) {
        settled = true;
        reject(
          new Error(interactive ? `Google auth failed${r.error ? ` (${r.error})` : ""}.` : RECONNECT),
        );
        return;
      }
      try {
        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({ t: r.access_token, exp: Date.now() + ((r.expires_in ?? 3600) - 120) * 1000 }),
        );
      } catch {
        /* private mode — token stays in-memory via GIS */
      }
      settled = true;
      resolve(r.access_token);
    };

    if (!tokenClient) {
      tokenClient = o.initTokenClient({
        client_id: driveClientId(),
        scope: SCOPE,
        callback,
        error_callback: fail,
      });
    } else {
      tokenClient.callback = callback;
      tokenClient.error_callback = fail;
    }
    // A silent refresh should return in a second or two; if GIS stays quiet
    // (common in an installed PWA with no Google session), stop waiting.
    if (!interactive) window.setTimeout(fail, 8000);
    try {
      tokenClient.requestAccessToken(interactive ? undefined : { prompt: "" });
    } catch {
      fail();
    }
  });
}

/** Interactive connect from the vault: consent + create the folder up front. */
export async function connectDrive(): Promise<void> {
  const token = await getAccessToken(true);
  await ensureFolder(token);
  await setSetting("driveConnected", "1");
}

export async function disconnectDrive(): Promise<void> {
  clearCachedToken();
  await setSetting("driveConnected", "0");
}

/** Drop the cached access token so the next request re-consents (e.g. after a
 * scope change, or when connecting the Google account). */
export function clearCachedToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Find or create the app's folder; the id is cached in settings. */
export async function ensureFolder(token: string): Promise<string> {
  const saved = await getSetting("driveFolderId");
  if (saved) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${saved}?fields=id,trashed`,
      { headers: auth(token) },
    );
    if (res.ok) {
      const f = (await res.json()) as { trashed?: boolean };
      if (!f.trashed) return saved;
    }
  }
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: auth(token),
  });
  if (list.ok) {
    const d = (await list.json()) as { files?: { id: string }[] };
    if (d.files && d.files[0]) {
      await setSetting("driveFolderId", d.files[0].id);
      return d.files[0].id;
    }
  }
  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { ...auth(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!create.ok) throw new Error(`Couldn't create the Drive folder (${create.status}).`);
  const folder = (await create.json()) as { id: string };
  await setSetting("driveFolderId", folder.id);
  return folder.id;
}

/** Multipart upload of an encrypted blob; returns the Drive file id. */
export async function uploadEncrypted(
  token: string,
  folderId: string,
  name: string,
  bytes: Uint8Array,
): Promise<string> {
  const boundary = "biblio" + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    { name, parents: [folderId] },
  )}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, bytes as unknown as BlobPart, tail]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { ...auth(token), "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}

export async function downloadEncrypted(token: string, fileId: string): Promise<Uint8Array> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: auth(token),
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export interface GoogleIdentity {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Read the signed-in user's profile from the OpenID userinfo endpoint. */
export async function getIdentity(token: string): Promise<GoogleIdentity> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: auth(token),
  });
  if (!res.ok) throw new Error(`Couldn't read your Google profile (${res.status}).`);
  const d = (await res.json()) as GoogleIdentity;
  return { sub: d.sub, email: d.email, name: d.name, picture: d.picture };
}

/** Find a file by name in the hidden app-only appDataFolder space. */
export async function findAppDataFile(token: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name}'`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=${APPDATA}&q=${q}&fields=files(id)`,
    { headers: auth(token) },
  );
  if (!res.ok) return null;
  const d = (await res.json()) as { files?: { id: string }[] };
  return d.files?.[0]?.id ?? null;
}

export async function readAppDataFile<T>(token: string, fileId: string): Promise<T | null> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: auth(token),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Create a small JSON file in the appDataFolder; returns its id. */
export async function createAppDataFile(token: string, name: string, obj: unknown): Promise<string> {
  const boundary = "biblio" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [APPDATA] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(obj) +
    `\r\n--${boundary}--`;
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { ...auth(token), "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Couldn't write app data (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}
