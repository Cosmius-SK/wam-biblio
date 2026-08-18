/**
 * The session cookie — biblio's new front door.
 *
 * A signed, HttpOnly cookie carrying who is asking. Verified in the Edge
 * middleware, so it uses nothing but Web Crypto and has no Node dependencies.
 *
 * This does NOT replace the shared passcode in the same release. Both doors
 * stay open until this one has been proven on real devices; see
 * docs/releases.md, "Cutovers".
 */
export const SESSION_COOKIE = "biblio_session";
/** How long a signed-in device stays signed in without re-verifying. */
export const SESSION_DAYS = 60;

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  /** Issued at, ms. */
  iat: number;
  /** Expires at, ms. */
  exp: number;
}

/**
 * The signing key. `AUTH_SECRET` is the right answer; the passcode is accepted
 * as a seed so an existing deployment gains the new door without new config.
 * With neither, the door simply does not exist — the passcode gate is
 * untouched, which is the safe direction to fail.
 */
function secret(): string {
  return process.env.AUTH_SECRET || process.env.APP_PASSCODE || "";
}

export function sessionsConfigured(): boolean {
  return secret().length > 0;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`biblio-session-v1:${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time-ish compare, so a wrong signature leaks nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signSession(user: Omit<SessionUser, "iat" | "exp">): Promise<string> {
  const now = Date.now();
  const payload: SessionUser = {
    ...user,
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** The user this cookie names, or null if it is missing, forged or expired. */
export async function verifySession(cookie: string | undefined): Promise<SessionUser | null> {
  if (!cookie || !sessionsConfigured()) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  try {
    const expected = b64urlEncode(
      new Uint8Array(
        await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body)),
      ),
    );
    if (!safeEqual(sig, expected)) return null;
    const user = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionUser;
    if (!user?.sub || typeof user.exp !== "number" || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}
