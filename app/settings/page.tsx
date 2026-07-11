"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getSetting, setSetting } from "@/lib/db";
import { ambient } from "@/lib/ambient";
import PortraitStudio from "@/components/PortraitStudio";
import ModelChooser from "@/components/ModelChooser";
import StylePicker from "@/components/StylePicker";
import GoogleAccount from "@/components/GoogleAccount";

/**
 * Settings hub. Real sections today: your name, and a gateway to backup /
 * sync / photos. The rest are placeholders we'll wire up over time.
 */
export default function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-7 mt-4">
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-muted">Make it yours.</p>
      </div>

      <ProfileCard />

      <div className="mt-4">
        <GoogleAccount />
      </div>

      <AmbientCard />

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Illustration model</h2>
        <p className="mt-1 text-sm text-muted">
          Which Gemini model draws your card illustrations. Refresh to pull the latest,
          pick one, and Update — or leave it on Auto.
        </p>
        <div className="mt-4">
          <ModelChooser />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Illustration style</h2>
        <p className="mt-1 text-sm text-muted">
          The look of your card illustrations. Three calm styles in biblio&rsquo;s palette —
          applies to new illustrations.
        </p>
        <div className="mt-4">
          <StylePicker />
        </div>
      </div>

      <Link
        href="/vault"
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-hairline/70 bg-surface/60 p-5 transition-colors hover:border-lavender/40"
      >
        <div>
          <h2 className="font-serif text-lg text-ink">Backup, sync &amp; photos</h2>
          <p className="mt-1 text-sm text-muted">
            Encrypted file backup, cross‑device sync, and Google Drive for photos.
          </p>
        </div>
        <Chevron />
      </Link>

      <h3 className="mb-2 mt-8 px-1 text-xs font-medium uppercase tracking-wide text-muted/70">
        Coming soon
      </h3>
      <ul className="overflow-hidden rounded-2xl border border-hairline/60">
        {[
          ["Appearance", "Light, dark, or follow the time of day."],
          ["Daily reminder", "A gentle nudge to write, at a time you pick."],
          ["Memories", "On‑this‑day and mood‑curated stories from your past."],
          ["Export your journal", "Download everything as plain, readable files."],
          ["About biblio", "Version, privacy, and how it all works."],
        ].map(([title, desc], i) => (
          <li
            key={title}
            className={`flex items-center justify-between gap-3 bg-surface/40 px-5 py-4 ${
              i > 0 ? "border-t border-hairline/50" : ""
            }`}
          >
            <div>
              <p className="text-ink/80">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender">
              Soon
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-muted/70">
        Ambient music and the AI mode (Sample / Live) are in the header, one tap away.
      </p>
    </motion.div>
  );
}

function ProfileCard() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSetting("displayName").then((v) => {
      if (v) setName(v);
    });
  }, []);

  async function save() {
    await setSetting("displayName", name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Profile</h2>
      <p className="mt-1 text-sm text-muted">What should the journal call you?</p>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="flex-1 rounded-xl border border-hairline bg-paper/50 px-4 py-2.5 text-ink placeholder:text-muted/60 focus:border-lavender/60"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.02] active:scale-95"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <PortraitStudio />
    </div>
  );
}

function AmbientCard() {
  const [vol, setVol] = useState(70);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setVol(Math.round(ambient.getVolume() * 100));
    setPlaying(ambient.isPlaying());
    return ambient.subscribe(setPlaying);
  }, []);

  function change(v: number) {
    setVol(v);
    ambient.setVolume(v / 100);
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">Ambient sound</h2>
        <button
          type="button"
          onClick={() => ambient.toggle()}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            playing
              ? "bg-lavender/15 text-lavender"
              : "border border-hairline text-muted hover:text-ink"
          }`}
        >
          {playing ? "Playing" : "Play"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Volume of the generated ambient pad.</p>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => change(Number(e.target.value))}
          aria-label="Ambient volume"
          className="h-2 flex-1 cursor-pointer accent-lavender"
        />
        <span className="w-10 text-right text-sm tabular-nums text-muted">{vol}%</span>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-muted"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
