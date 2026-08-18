/** Small presentation helpers shared across the UI. */

/**
 * Date/time formatters. Pass the entry's stamped IANA `timezone` to show the
 * original wall-clock time no matter where the reader is now; an invalid or
 * missing zone falls back to the viewer's local time. Backdated entries from
 * earlier years include the year.
 */
export function formatDate(ms: number, tz?: string): string {
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  };
  try {
    return d.toLocaleDateString(undefined, { ...opts, ...(tz ? { timeZone: tz } : {}) });
  } catch {
    return d.toLocaleDateString(undefined, opts);
  }
}

export function formatTime(ms: number, tz?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  try {
    return new Date(ms).toLocaleTimeString(undefined, { ...opts, ...(tz ? { timeZone: tz } : {}) });
  } catch {
    return new Date(ms).toLocaleTimeString(undefined, opts);
  }
}

/** True when the entry was written in a different time zone than the viewer's. */
export function zoneDiffers(tz?: string): boolean {
  if (!tz) return false;
  try {
    return tz !== Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return false;
  }
}

/** Short zone label, e.g. "GMT+5:30" — shown only when zoneDiffers(). */
export function shortZone(ms: number, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date(ms));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** A gentle greeting based on the local hour. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Still awake";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Winding down";
}

/**
 * Estimated USD cost of a structuring call, from real per-million-token pricing.
 * Lets the UI show honest, live cost transparency.
 */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-4-8": { in: 5, out: 25 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(3)}`;
}

/** Short, human label for which model shaped an entry. */
export function modelLabel(model: string): string {
  if (model === "sample") return "Sample";
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

/** How long ago, in the words a person would use rather than a timestamp. */
export function agoLabel(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
