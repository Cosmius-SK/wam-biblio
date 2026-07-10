"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { Portrait } from "@/lib/types";
import { deletePortrait, listPortraits, savePortrait } from "@/lib/db";
import { driveConfigured, isDriveConnected } from "@/lib/drive";
import { prepareImage, uploadPortrait } from "@/lib/media";
import PortraitTimelapse from "./PortraitTimelapse";

/** "YYYY-MM" ↔ epoch millis (first of the month, local time). */
function monthToMs(value: string): number {
  const [y, m] = value.split("-").map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m - 1, 1).getTime() : Date.now();
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The self-portrait studio inside the Profile card: keep a current portrait,
 * add new ones over time, and play them back as a fluid MM‑YY timelapse.
 * Originals are encrypted into the writer's own Drive; the thumbnails that
 * power the avatar and the timelapse stay on-device.
 */
export default function PortraitStudio() {
  const [ready, setReady] = useState<"loading" | "unconfigured" | "disconnected" | "ready">(
    "loading",
  );
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listPortraits();
      if (!cancelled) setPortraits(list);
      if (!driveConfigured()) {
        if (!cancelled) setReady("unconfigured");
        return;
      }
      const connected = await isDriveConnected();
      if (!cancelled) setReady(connected ? "ready" : "disconnected");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Newest first for the avatar and the management strip; the timelapse itself
  // plays oldest → newest (listPortraits order).
  const oldestFirst = [...portraits].sort((a, b) => a.capturedAt - b.capturedAt);
  const newestFirst = [...oldestFirst].reverse();
  const latest = newestFirst[0];

  async function add(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const pending = await prepareImage(file);
      const portrait = await uploadPortrait(pending, monthToMs(month));
      await savePortrait(portrait);
      setPortraits((prev) => [...prev, portrait]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that portrait.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    await deletePortrait(id);
    setPortraits((prev) => prev.filter((p) => p.id !== id));
  }

  if (ready === "loading") return null;

  return (
    <div className="mt-5 border-t border-hairline/50 pt-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline/70 bg-paper/50">
          {latest ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail
            <img src={latest.thumb} alt="Your current portrait" className="h-full w-full object-cover" />
          ) : (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="text-muted/60"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-ink">Your portrait</h3>
          <p className="text-sm text-muted">
            {portraits.length === 0
              ? "Add a portrait to start your timelapse."
              : `${portraits.length} portrait${portraits.length === 1 ? "" : "s"} · watch yourself change over time.`}
          </p>
        </div>
      </div>

      {ready !== "ready" ? (
        <p className="mt-4 text-xs text-muted">
          To add portraits, connect Google Drive in{" "}
          <Link href="/vault" className="text-lavender underline-offset-2 hover:underline">
            Backup &amp; restore
          </Link>
          {ready === "unconfigured" ? " (deployment setup needed first — see README)" : ""}.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              Dated
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Portrait month"
                className="rounded-lg border border-hairline bg-paper/50 px-2 py-1 text-ink focus:border-lavender/60"
              />
            </label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => add(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-full border border-hairline bg-surface/60 px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add portrait"}
            </button>
            {portraits.length > 0 && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.02] active:scale-95"
              >
                Play timelapse
              </button>
            )}
          </div>

          {portraits.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {newestFirst.map((p) => (
                <li key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                  <img
                    src={p.thumb}
                    alt=""
                    className="h-14 w-14 rounded-xl border border-hairline/60 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label="Remove portrait"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-[10px] text-paper"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
        </>
      )}

      <AnimatePresence>
        {playing && (
          <PortraitTimelapse portraits={oldestFirst} onClose={() => setPlaying(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
