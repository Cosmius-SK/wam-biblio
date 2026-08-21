"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DRIVE_FORBIDDEN,
  clearCachedToken,
  driveConfigured,
  driveGranted,
  getAccessToken,
  isDriveConnected,
} from "@/lib/drive";
import { deletePhotos, prepareImage, uploadPhotos } from "@/lib/media";
import type { EntryPhoto } from "@/lib/types";

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
 */
export default function PhotoAttach({
  photos,
  onChange,
}: {
  photos: EntryPhoto[];
  onChange: (photos: EntryPhoto[]) => void;
}) {
  const [ready, setReady] = useState<
    "loading" | "unconfigured" | "disconnected" | "no-permission" | "ready"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!driveConfigured()) {
        if (!cancelled) setReady("unconfigured");
        return;
      }
      const connected = await isDriveConnected();
      if (cancelled) return;
      if (!connected) {
        setReady("disconnected");
        return;
      }
      // A grant we have seen and that lacks Drive is the one case worth
      // catching early; never having seen one is not evidence of anything.
      setReady(driveGranted() === false ? "no-permission" : "ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (msg === DRIVE_FORBIDDEN) {
          setReady("no-permission");
          setError(null);
          break;
        }
        setError(msg || "That photo couldn't be kept — try again.");
      }
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (ready === "loading") return null;

  if (ready === "no-permission") {
    return (
      <div className="mt-4">
        <p className="text-xs leading-relaxed text-terracotta">
          Google didn&rsquo;t grant biblio permission to save files to your Drive, so photos
          can&rsquo;t be attached. It&rsquo;s a separate tick box on the consent screen and
          it&rsquo;s easy to miss.
        </p>
        <button
          type="button"
          onClick={() => {
            clearCachedToken();
            // Forced consent: Google will not re-offer a permission it thinks
            // it has already asked about, and this is precisely the case where
            // it needs to ask again.
            void getAccessToken(true, true)
              .then(() => setReady(driveGranted() === false ? "no-permission" : "ready"))
              .catch(() => setError("That didn't work — try again."));
          }}
          className="mt-2 rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Grant Drive access
        </button>
        {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
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
          onClick={() => inputRef.current?.click()}
          disabled={busy}
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
          {busy ? "Keeping…" : "Add photos"}
        </button>
        <span className="text-xs text-muted/80">Encrypted into your own Drive as you add them.</span>
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
