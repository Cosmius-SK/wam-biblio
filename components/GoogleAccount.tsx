"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  googleConfigured,
  getProfile,
  isGoogleConnected,
  lastSyncedAt,
  signInWithGoogle,
  signOutGoogle,
  syncNow,
  type Profile,
} from "@/lib/googleAccount";

function ago(ms: number | null): string {
  if (!ms) return "not yet";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * Sign in with Google to sync automatically across devices. The account keeps
 * the encryption key in its own hidden Drive folder, so a second device just
 * signs in and its journal reassembles itself.
 */
export default function GoogleAccount() {
  const [configured, setConfigured] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState<number | null>(null);

  useEffect(() => {
    setConfigured(googleConfigured());
    void (async () => {
      if (await isGoogleConnected()) setProfile(await getProfile());
      setSynced(await lastSyncedAt());
    })();
  }, []);

  async function connect() {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const p = await signInWithGoogle();
      setProfile(p);
      setSynced(await lastSyncedAt());
      setStatus("Signed in — your journal is syncing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in with Google.");
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      await syncNow();
      setSynced(await lastSyncedAt());
      setStatus("Synced.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sync.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await signOutGoogle();
    setProfile(null);
    setStatus("Signed out on this device.");
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Account &amp; sync</h2>
        <p className="mt-1 text-sm text-muted">
          Google sign-in isn&rsquo;t configured on this deployment yet (see README).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Account &amp; sync</h2>

      {profile ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            {profile.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Google avatar
              <img
                src={profile.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-full border border-hairline/60 object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lavender/15 font-serif text-lavender">
                {(profile.name || profile.email || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-ink">{profile.name || "Signed in"}</p>
              {profile.email && <p className="truncate text-xs text-muted">{profile.email}</p>}
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            Syncing automatically across your devices · last sync {ago(synced)}.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={busy}
              className="rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-50"
            >
              {busy ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm font-medium text-ink transition-transform enabled:active:scale-95 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Sign in with Google to sync your journal across devices automatically — no
            passphrase to remember. Your entries stay encrypted end-to-end.
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="mt-4 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
          <p className="mt-3 text-xs text-muted/80">
            Prefer no account? The{" "}
            <Link href="/vault" className="text-lavender underline-offset-2 hover:underline">
              passphrase vault
            </Link>{" "}
            still gives you zero-knowledge backup &amp; sync.
          </p>
        </>
      )}

      {status && <p className="mt-3 rounded-xl bg-sage/15 px-3 py-2 text-xs text-sage">{status}</p>}
      {error && <p className="mt-3 rounded-xl bg-terracotta/10 px-3 py-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}
