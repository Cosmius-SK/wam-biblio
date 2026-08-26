"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEFAULT_FACE, describeFace, type Face } from "@/lib/world/face";
import { newMember } from "@/lib/world/types";
import { listWorld, saveMember, unknownNames } from "@/lib/world/store";
import FaceBuilder from "./FaceBuilder";

/**
 * The offer, made at the only moment it explains itself.
 *
 * A picture has just been drawn of people biblio does not know, so it invented
 * them — and whoever is looking at it has just seen the result. Asking here
 * costs one sentence and needs no explanation of what a "cast" is. Asking on a
 * settings page, before anyone has seen a generic family, needs several
 * paragraphs and still gets ignored.
 *
 * Rules it must keep: the picture is drawn first, exactly as asked, and this
 * never blocks it. It is per person. And *not now* means not now — a name that
 * was declined is not offered again by this route, because the third time of
 * being asked the same question is the time somebody turns the feature off.
 */
const DECLINED_KEY = "biblio_world_declined";

function declined(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DECLINED_KEY) || "[]") as unknown;
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  } catch {
    return new Set();
  }
}

function decline(name: string): void {
  try {
    const all = declined();
    all.add(name.toLowerCase());
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...all]));
  } catch {
    /* private mode — it will ask again, which is the kinder failure */
  }
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function RememberOffer({
  entities,
  onKept,
}: {
  /** The people this entry mentioned, from the shaping pass. */
  entities?: string[];
  onKept?: () => void;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [face, setFace] = useState<Face>({ ...DEFAULT_FACE });

  useEffect(() => {
    void (async () => {
      const fresh = unknownNames(await listWorld(), entities ?? []);
      const no = declined();
      setNames(fresh.filter((n) => !no.has(n.toLowerCase())).slice(0, 3));
    })();
  }, [entities]);

  async function keep(name: string) {
    const member = newMember("person", name);
    member.face = face;
    await saveMember(member);
    setNames((rest) => rest.filter((n) => n !== name));
    setBuilding(null);
    setFace({ ...DEFAULT_FACE });
    onKept?.();
  }

  function notNow(name: string) {
    decline(name);
    setNames((rest) => rest.filter((n) => n !== name));
    setBuilding(null);
  }

  if (names.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-hairline/70 bg-paper/50 p-3">
      <AnimatePresence mode="wait">
        {building ? (
          <motion.div key="build" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm text-ink">
              What does <span className="font-medium">{building}</span> look like?
            </p>
            <p className="mt-0.5 text-2xs text-muted/80">
              Near enough is the whole idea — it only has to be recognisably them.
            </p>
            <div className="mt-3">
              <FaceBuilder face={face} onChange={setFace} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void keep(building)}
                className="rounded-full bg-ink/90 px-4 py-2 text-xs font-medium text-paper"
              >
                That&rsquo;s {building}
              </button>
              <button
                type="button"
                onClick={() => setBuilding(null)}
                className="text-xs text-muted transition-colors hover:text-ink"
              >
                Back
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm text-ink">
              {joinNames(names)} {names.length === 1 ? "doesn't" : "don't"} have a face yet.
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Give them one and they&rsquo;ll look the same in every picture. Their name
              stays on this device either way.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {names.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBuilding(n)}
                  className="rounded-full border border-lavender/50 bg-lavender/10 px-3 py-1.5 text-xs text-ink transition-colors hover:border-lavender"
                >
                  Remember {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => names.forEach(notNow)}
                className="rounded-full px-3 py-1.5 text-xs text-muted/80 transition-colors hover:text-ink"
              >
                Not now
              </button>
            </div>
            {/* The sentence they are agreeing to, before they agree to it. */}
            <p className="mt-2 text-2xs text-muted/60">
              A face becomes words like &ldquo;{describeFace(DEFAULT_FACE)}&rdquo; — that is
              all a picture is ever told.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
