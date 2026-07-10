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
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "biblio-journal";
const TOKEN_KEY = "biblio_drive_token";

/** Sentinel error message: the user needs to (re)connect interactively. */
export const RECONNECT = "DRIVE_RECONNECT";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  callback: (r: TokenResponse) => void;
  requestAccessToken: (cfg?: { prompt?: string }) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
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
    const callback = (r: TokenResponse) => {
      if (!r.access_token) {
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
      resolve(r.access_token);
    };
    if (!tokenClient) {
      tokenClient = o.initTokenClient({ client_id: driveClientId(), scope: SCOPE, callback });
    } else {
      tokenClient.callback = callback;
    }
    try {
      tokenClient.requestAccessToken(interactive ? undefined : { prompt: "" });
    } catch {
      reject(new Error(interactive ? "Google auth failed." : RECONNECT));
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
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  await setSetting("driveConnected", "0");
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
