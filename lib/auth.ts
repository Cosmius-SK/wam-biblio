/**
 * Lightweight access gate. A single shared passcode (env `APP_PASSCODE`) lets
 * only the owner in — protecting the public URL and, crucially, the
 * spend-capable AI routes. When no passcode is configured the gate is OFF
 * (fail-open) so the app is never accidentally bricked.
 *
 * The auth cookie stores a SHA-256 token derived from the passcode, not the
 * passcode itself. Works in both the Edge middleware and Node routes (uses the
 * Web Crypto `crypto.subtle`, available in both).
 */
export const COOKIE_NAME = "biblio_gate";

export function passcode(): string {
  return process.env.APP_PASSCODE ?? "";
}

/** The gate is active only when a non-empty passcode is configured. */
export function isGateConfigured(): boolean {
  return passcode().trim().length > 0;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The token a valid auth cookie must equal — derived from the passcode. */
export function expectedToken(): Promise<string> {
  return sha256Hex(`biblio-gate-v1:${passcode()}`);
}

/** Constant-time-ish string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
