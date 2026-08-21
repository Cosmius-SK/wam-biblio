"use client";

/**
 * Whether this browser belongs to the deployment owner.
 *
 * Cached for the session because it cannot change without signing in again,
 * and defaults to *not* the owner — so owner-only detail is hidden by mistake
 * rather than shown by mistake.
 */
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export async function isOwner(): Promise<boolean> {
  if (cached !== null) return cached;
  if (!inflight) {
    inflight = fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d: { owner?: boolean }) => {
        cached = !!d.owner;
        return cached;
      })
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
