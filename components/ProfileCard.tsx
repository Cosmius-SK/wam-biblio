"use client";

import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import PortraitStudio from "./PortraitStudio";

/** Profile: what the journal calls you, plus the portrait timelapse studio. */
export default function ProfileCard() {
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
      <h2 className="font-serif text-lg text-ink">Your name</h2>
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
