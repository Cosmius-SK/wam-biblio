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
// holds the sync key. userinfo.email/profile: identity for the account UI.
// (No `openid` — that's for the ID-token flow, not this access-token client.)
const SCOPE = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");
const FOLDER_NAME = "biblio-journal";
const TOKEN_KEY = "biblio_drive_token";
const SCOPE_KEY = "biblio_drive_scopes";
const APPDATA = "appDataFolder";

/** Sentinel error message: the user needs to (re)connect interactively. */
export const RECONNECT = "DRIVE_RECONNECT";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  /** What Google actually granted, which may be less than we asked for. */
  scope?: string;
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
    /** Which account this is for — see `rememberAccountHint`. */
    hint?: string;
  }) => TokenClient;
}

let tokenClient: TokenClient | null = null;
/** The hint the current client was built with, so a change rebuilds it. */
let tokenClientHint = "";

const HINT_KEY = "biblio_google_hint";

/**
 * Remember which Google account this is, for the token client's `hint`.
 *
 * It does two things worth having. A silent refresh has a much better chance
 * of succeeding when Google is told which of several signed-in accounts to
 * resolve, and an interactive one skips the account chooser entirely — so the
 * popup opens and closes itself without anybody being asked anything, which is
 * the difference between "a flash" and "a dialog".
 *
 * localStorage rather than the database because it has to be readable
 * synchronously: the code that needs it is running inside a tap, and an
 * IndexedDB round trip there costs the very gesture it is trying to spend.
 */
export function rememberAccountHint(email?: string): void {
  try {
    if (email) localStorage.setItem(HINT_KEY, email);
  } catch {
    /* private mode — Google will simply ask */
  }
}

function accountHint(): string {
  try {
    return localStorage.getItem(HINT_KEY) || "";
  } catch {
    return "";
  }
}
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

/** A token already in hand, if any. Synchronous, so it costs no gesture. */
export function cachedAccessToken(): string | null {
  return cachedToken();
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
export async function getAccessToken(interactive: boolean, force = false): Promise<string> {
  if (!driveConfigured()) throw new Error(RECONNECT);
  const cached = force ? null : cachedToken();
  if (cached) return cached;
  await loadGis();
  const o = oauth2();
  if (!o) throw new Error("Google sign-in didn't load.");
  return new Promise<string>((resolve, reject) => {
    // A single settle guard: GIS can fire callback, error_callback, throw, or —
    // on a silent refresh it can't complete — go quiet. Any of these must
    // resolve or reject exactly once, so the caller never hangs. On interactive
    // failure we surface Google's actual reason (e.g. access_denied,
    // popup_closed, invalid_client) instead of a bare "auth failed".
    let settled = false;
    let detail = "";
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(interactive ? `Google auth failed${detail ? ` — ${detail}` : ""}.` : RECONNECT));
    };
    const onError = (e?: TokenError) => {
      detail = e?.type || e?.message || "";
      fail();
    };

    const callback = (r: TokenResponse) => {
      if (settled) return;
      if (!r.access_token) {
        detail = r.error || "";
        fail();
        return;
      }
      try {
        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({ t: r.access_token, exp: Date.now() + ((r.expires_in ?? 3600) - 120) * 1000 }),
        );
        // Google's consent screen lets people untick the Drive permissions
        // separately, and hands back a perfectly valid token without them. The
        // failure then surfaces as a 403 much later, while attaching a photo —
        // so record what was actually granted and say so up front instead.
        if (r.scope) localStorage.setItem(SCOPE_KEY, r.scope);
      } catch {
        /* private mode — token stays in-memory via GIS */
      }
      settled = true;
      resolve(r.access_token);
    };

    const hint = accountHint();
    if (!tokenClient || tokenClientHint !== hint) {
      tokenClientHint = hint;
      tokenClient = o.initTokenClient({
        client_id: driveClientId(),
        scope: SCOPE,
        callback,
        error_callback: onError,
        ...(hint ? { hint } : {}),
      });
    } else {
      tokenClient.callback = callback;
      tokenClient.error_callback = onError;
    }
    // A silent refresh should return in a second or two; if GIS stays quiet
    // (common in an installed PWA with no Google session), stop waiting.
    if (!interactive) window.setTimeout(fail, 8000);
    try {
      // `consent` forces the permission screen back up even when Google
      // thinks it has already asked — the only way to re-offer a Drive tick
      // that was declined the first time.
      tokenClient.requestAccessToken(
        interactive ? (force ? { prompt: "consent" } : undefined) : { prompt: "" },
      );
    } catch (e) {
      detail = e instanceof Error ? e.message : "";
      fail();
    }
  });
}

/** When the token in hand expires, or null when there isn't one. */
export function tokenExpiry(): number | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

/** Close enough to the end that it is worth replacing now, quietly. */
const REFRESH_WINDOW_MS = 12 * 60_000;

/**
 * Keep a Drive token in hand without ever interrupting anyone.
 *
 * Google's browser token flow hands out an access token good for about an
 * hour and no refresh token, so a journal left open for an afternoon is a
 * journal whose Drive quietly stopped working. The only repair on offer is a
 * popup, a popup needs a tap, and the tap it landed on was whichever one
 * happened next — which is why "Drive needs reconnecting" kept appearing at
 * the exact moment someone was trying to attach a photo, over and over.
 *
 * So ask for the replacement *before* the old one dies, at a quiet moment,
 * silently. Where the browser still has a Google session — an ordinary tab,
 * most laptops — nobody ever learns this was a problem. Where it doesn't, this
 * fails silently and the picker can say so in advance of the tap instead of
 * after it.
 */
export async function refreshTokenIfStale(): Promise<boolean> {
  if (!driveConfigured()) return false;
  const exp = tokenExpiry();
  if (exp && exp - Date.now() > REFRESH_WINDOW_MS) return true; // plenty left
  try {
    // force: skip the cache, which would hand back the very token that is
    // about to expire. Non-interactive: this must never open anything.
    await getAccessToken(false, true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spend a tap the user is already making on the Drive token.
 *
 * A browser will not open a popup unless a real gesture is in flight, and no
 * amount of arranging changes that: coming back to the foreground grants
 * nothing, and a fingerprint grants nothing either — WebAuthn consumes user
 * activation, it does not issue it. What *is* a gesture is the tap somebody
 * makes to unlock, so that is the one to use, before it is spent on anything
 * else. With consent already given and the account hinted, Google's window
 * opens and closes itself; nobody is asked anything.
 *
 * Never throws: a token that could not be renewed is a photo button that says
 * so later, not an unlock that failed.
 */
const PROMPT_KEY = "biblio_drive_prompt_at";
/** Two prompts inside this window is Google appearing "all the time". */
const PROMPT_COOLDOWN_MS = 45 * 60_000;
/** A prompt that failed or was dismissed says this device wants the long way. */
const PROMPT_BACKOFF_MS = 6 * 60 * 60_000;

function promptedRecently(): boolean {
  try {
    const raw = localStorage.getItem(PROMPT_KEY);
    if (!raw) return false;
    const { at, ok } = JSON.parse(raw) as { at?: number; ok?: boolean };
    if (typeof at !== "number") return false;
    return Date.now() - at < (ok === false ? PROMPT_BACKOFF_MS : PROMPT_COOLDOWN_MS);
  } catch {
    return false;
  }
}

function notePrompt(ok: boolean): void {
  try {
    localStorage.setItem(PROMPT_KEY, JSON.stringify({ at: Date.now(), ok }));
  } catch {
    /* private mode */
  }
}

export async function topUpFromGesture(): Promise<boolean> {
  if (!driveConfigured()) return false;
  // A token still in hand needs nothing, and asking anyway is the whole
  // complaint: Google turning up again when nothing was wrong.
  if (cachedToken()) return true;
  // The lock screen comes up after five minutes away, so without a floor on
  // how often this may ask, "renew it on the unlock tap" becomes "Google every
  // time you pick up your phone". Once an hour at most, and much less than
  // that on a device where it did not work — there, the photo button's own
  // Connect is the honest path and this should stay out of the way.
  if (promptedRecently()) return false;
  try {
    await getAccessToken(true);
    notePrompt(true);
    return true;
  } catch {
    notePrompt(false);
    return false;
  }
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
    localStorage.removeItem(SCOPE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whether Drive access was actually granted. `null` means we have not seen a
 * grant yet and cannot say — which must not be reported as "no".
 */
/** The raw scope string Google last granted, for diagnosis. */
export function grantedScopes(): string | null {
  try {
    return localStorage.getItem(SCOPE_KEY);
  } catch {
    return null;
  }
}

export function driveGranted(): boolean | null {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (!raw) return null;
    return raw.includes("drive.file");
  } catch {
    return null;
  }
}

/**
 * A Drive failure that still carries what Google said.
 *
 * The friendly sentence is what a writer should see; the raw body is what
 * actually diagnoses it — a disabled API, a wrong project and a declined
 * permission all arrive as 403 and mean completely different things. Replacing
 * one with the other made the diagnostic useless.
 */
export class DriveError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(message: string, status: number, detail: string) {
    super(message);
    this.name = "DriveError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Google answers in JSON. A page of HTML means something sat between us and
 * Google and answered on its behalf — a corporate web filter, a captive
 * portal, a VPN. Those return 403 too, and telling someone to go and re-tick a
 * permission box is then both useless and misleading: their account is fine,
 * their network is not.
 */
function intercepted(body: string): boolean {
  return /^\s*(<!DOCTYPE|<html)/i.test(body);
}

async function driveFail(res: Response, friendly: string): Promise<never> {
  const body = await res.text().catch(() => "");
  const message = intercepted(body)
    ? DRIVE_BLOCKED
    : res.status === 403
      ? DRIVE_FORBIDDEN
      : friendly;
  throw new DriveError(message, res.status, body.slice(0, 600));
}

/** The message for a Drive call refused for lack of permission. */
export const DRIVE_FORBIDDEN =
  "Google didn't grant biblio permission to save files to your Drive. Reconnect and leave the Drive box ticked on the consent screen.";

/** Something on the network answered instead of Google. */
export const DRIVE_BLOCKED =
  "Something on this network blocked the upload to Google — usually a company web filter or a VPN. Your account is fine. Try another network, or add the photo from your phone.";

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
  if (!create.ok) await driveFail(create, `Couldn't create the Drive folder (${create.status}).`);
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
  if (!res.ok) await driveFail(res, `Upload failed (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}

export async function downloadEncrypted(token: string, fileId: string): Promise<Uint8Array> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: auth(token),
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Overwrite an existing appDataFolder JSON file in place. */
export async function updateAppDataFile(token: string, fileId: string, obj: unknown): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    },
  );
  if (!res.ok) throw new Error(`Couldn't update app data (${res.status}).`);
}

/** Delete a file this app created. Best effort: a file that is already gone,
 * or a Drive that is momentarily unreachable, is not worth surfacing. */
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: auth(token),
  });
}

export interface GoogleIdentity {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Read the signed-in user's profile (works with the userinfo.* scopes). */
export async function getIdentity(token: string): Promise<GoogleIdentity> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
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
