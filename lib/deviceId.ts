"use client";

/**
 * This device's identity — a random id it keeps to itself.
 *
 * Not a fingerprint: nothing is derived from the browser, so it cannot be used
 * to recognise anyone anywhere else. It exists so a person can look at a list
 * and see what holds a copy of their journal.
 */
const KEY = "biblio_device_id";

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private mode: a per-tab id is still better than none.
    return "ephemeral";
  }
}

function browserName(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Browser";
}

function platformName(ua: string): string {
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Device";
}

/** A first guess at a name. Renameable, because guesses are not much use. */
export function describeDevice(): { id: string; label: string; platform: string } {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const platform = platformName(ua);
  return { id: deviceId(), label: `${platform} · ${browserName(ua)}`, platform };
}
