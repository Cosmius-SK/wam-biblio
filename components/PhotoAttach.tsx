"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DRIVE_BLOCKED,
  DRIVE_FORBIDDEN,
  cachedAccessToken,
  clearCachedToken,
  driveConfigured,
  getAccessToken,
  isDriveConnected,
} from "@/lib/drive";
import { PHOTO_RECONNECT, deletePhotos, prepareImage, uploadPhotos } from "@/lib/media";
import type { EntryPhoto } from "@/lib/types";
import { isOwner } from "@/lib/owner";

const MAX_PHOTOS = 8;

/**
 * Photo picker for the capture screen. Photos are compressed, encrypted and
 * uploaded to the writer's own Drive the moment they're chosen — not when the
 * entry is kept.
 *
 * That timing is the point: a draft then carries references rather than
 * megabytes, so it can sync, and an entry begun on a phone can be finished on a
 * laptop that never saw the photo. It also moves the wait to while they're
 * still writing instead of at the moment they press keep. Requires Drive to be
 * connected (see the vault).
 *
 * The token is checked *before* the picker opens, not after a photo has been
 * chosen. Google's token lasts about an hour and can only be renewed from a
 * tap, and by the time a file has been picked, decoded and re-compressed the
 * browser no longer counts that tap as one — so the popup was blocked and the
 * failure surfaced as "reconnect Drive", every hour, always at the worst
 * moment. Ask first, while the tap still counts.
 */
/** A cheap localStorage read; often enough to catch an expiry mid-compose. */
const TOKEN_POLL_MS = 30_000;

export default function PhotoAttach({
  photos,
  onChange,
}: {
  photos: EntryPhoto[];
  onChange: (photos: EntryPhoto[]) => void;
}) {
  const [ready, setReady] = useState<
    "loading" | "unconfigured" | "disconnected" | "no-permission" | "blocked" | "ready"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Google's own words, shown only to whoever can act on them. */
  const [detail, setDetail] = useState<string | null>(null);
  const [owner, setOwner] = useState(false);
  /** Whether a usable Drive token is already in hand — decides which tap this is. */
  const [hasToken, setHasToken] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void isOwner().then(setOwner);
  }, []);

  useEffect(() => {
    const look = () => setHasToken(!!cachedAccessToken());
    look();
    const timer = window.setInterval(look, TOKEN_POLL_MS);
    document.addEventListener("visibilitychange", look);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!driveConfigured()) {
        if (!cancelled) setReady("unconfigured");
        return;
      }
      const connected = await isDriveConnected();
      if (cancelled) return;
      // Deliberately optimistic. An earlier version refused to even offer the
      // picker when a cached scope string looked wrong — and that string is
      // not reliable evidence, so it blocked people whose Drive worked
      // perfectly well. Try, and offer the fix only if Google actually says no.
      setReady(connected ? "ready" : "disconnected");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The tap. With a token in hand it opens the picker; without one it spends
   * the tap on Google instead, because that is the only thing a tap can buy
   * and the picker will need it a second later.
   */
  async function pick() {
    if (cachedAccessToken()) {
      inputRef.current?.click();
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await getAccessToken(true);
      setHasToken(true);
      // Deliberately not opening the picker here: a file dialog opened after
      // an await is blocked in the same browsers, for the same reason. One
      // more tap, and it works.
    } catch {
      setError("Google didn't finish — tap again.");
    } finally {
      setConnecting(false);
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) {
        setError(`Up to ${MAX_PHOTOS} photos per entry.`);
        break;
      }
      try {
        const [uploaded] = await uploadPhotos([await prepareImage(file)]);
        next.push(uploaded);
        onChange([...next]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // Drive refusing us is not a photo problem, and telling someone to go
        // and reconnect in Settings is a poor answer. Offer the fix here.
        if (msg === DRIVE_BLOCKED) {
          setReady("blocked");
          setError(null);
          break;
        }
        if (msg === DRIVE_FORBIDDEN) {
          setReady("no-permission");
          setError(null);
          const raw = (err as { detail?: string })?.detail;
          const status = (err as { status?: number })?.status;
          setDetail(raw ? `${status ?? ""} ${raw}`.trim() : null);
          break;
        }
        // The token died between opening the picker and finishing the upload.
        // Offer the fix here rather than sending anyone to a settings page.
        if (msg === PHOTO_RECONNECT) setHasToken(false);
        setError(msg || "That photo couldn't be kept — try again.");
      }
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (ready === "loading") return null;

  if (ready === "blocked") {
    return (
      <div className="mt-4">
        <p className="text-xs leading-relaxed text-terracotta">{DRIVE_BLOCKED}</p>
        <button
          type="button"
          onClick={() => setReady("ready")}
          className="mt-2 rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Try again
        </button>
      </div>
    );
  }

  if (ready === "no-permission") {
    return (
      <div className="mt-4">
        <p className="text-xs leading-relaxed text-terracotta">
          Google turned that away. Granting access again usually settles it.
        </p>
        <button
          type="button"
          onClick={() => {
            clearCachedToken();
            // Forced consent: Google will not re-offer a permission it thinks
            // it has already asked about, and this is precisely the case where
            // it needs to ask again.
            void getAccessToken(true, true)
              .then(() => {
                setReady("ready");
                setError(null);
              })
              .catch(() => setError("That didn't work — try again."));
          }}
          className="mt-2 rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Grant Drive access
        </button>
        {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
        {owner && detail && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-paper/40 p-3 font-mono text-[0.65rem] leading-relaxed text-muted">
            {detail}
          </pre>
        )}
      </div>
    );
  }

  if (ready !== "ready") {
    return (
      <p className="mt-4 text-xs text-muted">
        To attach photos, connect Google Drive in{" "}
        <Link href="/vault" className="text-lavender underline-offset-2 hover:underline">
          Backup &amp; restore
        </Link>
        {ready === "unconfigured" ? " (deployment setup needed first — see README)" : ""}.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void pick()}
          disabled={busy || connecting}
          className="flex items-center gap-2 rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
          {busy ? "Keeping…" : connecting ? "Connecting…" : hasToken ? "Add photos" : "Connect to add photos"}
        </button>
        <span className="text-xs text-muted/80">
          {hasToken
            ? "Encrypted into your own Drive as you add them."
            : "Google's hour is up — one tap lets biblio back in."}
        </span>
      </div>

      {photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
              <img
                src={p.thumb}
                alt=""
                className="h-20 w-20 rounded-xl border border-hairline/60 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  onChange(photos.filter((x) => x.id !== p.id));
                  void deletePhotos([p]);
                }}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-[10px] text-paper"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}
