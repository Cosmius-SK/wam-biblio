"use client";

import { useState } from "react";
import TellMaya from "./TellMaya";

const OWNER = process.env.NEXT_PUBLIC_OWNER_NAME || "the person who set this up";

/** Settings › Tell Maya — the same box, reachable whenever they want it. */
export default function TellMayaCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-terracotta/30 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Tell Maya</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Anything that&rsquo;s annoying, confusing, broken, or missing. Blunt is useful — this
        is being built for you, and nobody can fix what they don&rsquo;t hear about.
      </p>
      <p className="mt-3 rounded-xl bg-terracotta/10 px-4 py-3 text-sm leading-relaxed text-ink/80">
        <span className="font-medium text-terracotta">This is the one thing that leaves.</span>{" "}
        What you send here goes to {OWNER} and they read it. Your journal never does — they
        couldn&rsquo;t read it if they wanted to.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full bg-terracotta px-5 py-2.5 text-sm font-medium text-paper transition-transform active:scale-95"
      >
        Write to them
      </button>
      <TellMaya open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
