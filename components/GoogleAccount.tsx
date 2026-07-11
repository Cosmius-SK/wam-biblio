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
import type { SyncCounts, SyncProgress } from "@/lib/sync";

function ago(ms: number | null): string {
  if (!ms) return "not yet";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const PHASE_LABEL: Record<SyncProgress["phase"], string> = {
  prepare: "Preparing…",
  encrypt: "Encrypting…",
  upload: "Uploading",
  download: "Fetching…",
  merge: "Merging…",
  done: "Synced",
};

/** "12 entries · 3 portraits · 8 photos" — omits the zero categories. */
function itemsLabel(c: SyncCounts): string {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts: string[] = [];
  if (c.entries) parts.push(plural(c.entries, "entry", "entries"));
  if (c.portraits) parts.push(plural(c.portraits, "portrait"));
  if (c.photos) parts.push(plural(c.photos, "photo"));
  if (c.reflections) parts.push(plural(c.reflections, "reflection"));
  return parts.length ? parts.join(" · ") : "nothing yet";
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
  const [progress, setProgress] = useState<SyncProgress | null>(null);

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
    let last: SyncCounts | null = null;
    try {
      const { profile: p, syncError } = await signInWithGoogle((prog) => {
        setProgress(prog);
        last = prog.counts;
      });
      setProfile(p);
      setSynced(await lastSyncedAt());
      if (syncError) setError(syncError);
      else setStatus(last ? `Signed in — synced ${itemsLabel(last)}.` : "Signed in — your journal is syncing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in with Google.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 900);
    }
  }

  async function sync() {
    setError(null);
    setStatus(null);
    setBusy(true);
    let last: SyncCounts | null = null;
    try {
      await syncNow((prog) => {
        setProgress(prog);
        last = prog.counts;
      });
      setSynced(await lastSyncedAt());
      setStatus(last ? `Synced ${itemsLabel(last)}.` : "Synced.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sync.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 900);
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

      {progress && <SyncBar progress={progress} />}

      {status && !progress && (
        <p className="mt-3 rounded-xl bg-sage/15 px-3 py-2 text-xs text-sage">{status}</p>
      )}
      {error && <p className="mt-3 rounded-xl bg-terracotta/10 px-3 py-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}

/** A determinate bar for the upload, indeterminate for the other phases, with a
 * one-line summary of what's moving. */
function SyncBar({ progress }: { progress: SyncProgress }) {
  const { phase, percent, counts, item } = progress;
  const indeterminate = percent === null;
  const right = item ? `${item.done}/${item.total} items` : itemsLabel(counts);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{PHASE_LABEL[phase]}</span>
        <span className="tabular-nums">{right}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline/40">
        <div
          className={`h-full rounded-full bg-lavender transition-[width] duration-200 ${
            indeterminate ? "w-1/3 animate-pulse" : ""
          }`}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
