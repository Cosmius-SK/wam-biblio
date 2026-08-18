import type { SessionUser } from "./session";

/**
 * Turn a Google access token into a verified profile, server-side.
 *
 * The client already holds a token (lib/drive.ts). We do not take its word for
 * who it belongs to — Google is asked directly, once, at sign-in. After that
 * our own signed cookie carries the answer, so the AI routes never wait on a
 * round trip to Google.
 */
export interface VerifiedProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleToken(token: string): Promise<VerifiedProfile | null> {
  if (!token || token.length > 4096) return null;
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as VerifiedProfile;
    return d?.sub ? { sub: d.sub, email: d.email, name: d.name, picture: d.picture } : null;
  } catch {
    return null;
  }
}

export function toSessionUser(p: VerifiedProfile): Omit<SessionUser, "iat" | "exp"> {
  return { sub: p.sub, email: p.email, name: p.name };
}
