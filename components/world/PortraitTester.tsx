"use client";

import { useState } from "react";
import { describeFace, randomFace, type Face } from "@/lib/world/face";
import { castLine } from "@/lib/world/cast";
import { newMember, type WorldMember } from "@/lib/world/types";
import FaceBuilder from "./FaceBuilder";
import FacePortrait from "./FacePortrait";
import Framed from "./Framed";

/**
 * The owner's bench for the cast — Checks, beside the Drive and image testers.
 *
 * Two questions it exists to answer, neither of which can be settled by
 * reading code. Does the range of faces cover the people in a real family?
 * And does injecting a description actually change what comes back — the
 * premise the whole feature rests on — which needs the same scene drawn twice,
 * side by side, with and without.
 *
 * Nothing here touches the journal. The faces are scratch, and a test never
 * adds anyone to Your world.
 */
const SCENE =
  "Three on a scooter on a wet evening street, the smallest standing in front, a stack of small chairs strapped behind.";

interface Drawn {
  src: string;
  prompt: string;
}

export default function PortraitTester() {
  const [range, setRange] = useState<Face[]>(() => Array.from({ length: 8 }, randomFace));
  const [cast, setCast] = useState<WorldMember[]>(() => [scratch("Test person")]);
  const [editing, setEditing] = useState(0);
  const [scene, setScene] = useState(SCENE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plain, setPlain] = useState<Drawn | null>(null);
  const [withCast, setWithCast] = useState<Drawn | null>(null);

  function scratchAt(i: number, face: Face) {
    setCast((c) => c.map((m, n) => (n === i ? { ...m, face } : m)));
  }

  async function drawBoth() {
    setBusy(true);
    setError(null);
    setPlain(null);
    setWithCast(null);
    const line = castLine(cast);
    try {
      const a = await draw(scene);
      setPlain({ src: a, prompt: scene });
      const withThem = line ? `${scene} ${line}` : scene;
      const b = await draw(withThem);
      setWithCast({ src: b, prompt: withThem });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw anything.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Portraits & cast</h2>
      <p className="mt-1 text-sm text-muted">
        The faces people can choose from, and whether describing them actually changes the
        picture. Nothing here is saved to your world.
      </p>

      <p className="mt-5 text-xs uppercase tracking-wide text-muted/70">The range</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {range.map((f, i) => (
          <Framed key={i} size={78} back={describeFace(f)}>
            <FacePortrait face={f} size={78} />
          </Framed>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRange(Array.from({ length: 8 }, randomFace))}
        className="mt-3 rounded-full border border-hairline bg-paper/50 px-4 py-1.5 text-sm text-ink transition-colors hover:border-lavender/40"
      >
        Shuffle all
      </button>
      <p className="mt-2 text-2xs text-muted/70">
        Tap any frame to turn it over — the back is exactly what a picture would be told.
      </p>

      <div className="mt-6 border-t border-hairline/60 pt-5">
        <p className="text-xs uppercase tracking-wide text-muted/70">A test cast</p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          {cast.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEditing(i)}
              className={`rounded-xl border p-1.5 transition-colors ${
                editing === i ? "border-lavender/60 bg-lavender/10" : "border-transparent"
              }`}
            >
              {m.face && <FacePortrait face={m.face} size={62} className="rounded-lg" />}
            </button>
          ))}
          {cast.length < 3 && (
            <button
              type="button"
              onClick={() => {
                setCast((c) => [...c, scratch(`Test person ${c.length + 1}`)]);
                setEditing(cast.length);
              }}
              className="h-[74px] w-[74px] rounded-xl border border-dashed border-hairline text-sm text-muted transition-colors hover:border-lavender/40 hover:text-ink"
            >
              + one
            </button>
          )}
          {cast.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setCast((c) => c.slice(0, -1));
                setEditing(0);
              }}
              className="self-center text-xs text-muted/80 transition-colors hover:text-ink"
            >
              Remove last
            </button>
          )}
        </div>

        {cast[editing]?.face && (
          <div className="mt-4">
            <FaceBuilder
              face={cast[editing].face as Face}
              onChange={(f) => scratchAt(editing, f)}
            />
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-hairline/60 pt-5">
        <label htmlFor="pt-scene" className="text-xs uppercase tracking-wide text-muted/70">
          The scene, as an entry would give it
        </label>
        <textarea
          id="pt-scene"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          className="mt-1.5 w-full resize-none rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-sm text-ink focus:border-lavender/60 focus:outline-none"
        />
        <p className="mt-2 rounded-xl bg-paper/40 p-3 text-2xs leading-4 text-muted">
          <span className="uppercase tracking-wide text-muted/70">Appended</span>
          <br />
          {castLine(cast) || "— nothing, no cast"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void drawBoth()}
            disabled={busy}
            className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40 disabled:opacity-50"
          >
            {busy ? "Drawing…" : "Draw it both ways"}
          </button>
          <span className="text-xs text-muted/70">Two illustrations · about 8¢</span>
        </div>

        {error && (
          <p className="mt-3 break-words rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {error}
          </p>
        )}

        {(plain || withCast) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Panel title="As it is today" drawn={plain} />
            <Panel title="With the cast" drawn={withCast} busy={busy && !withCast} />
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, drawn, busy }: { title: string; drawn: Drawn | null; busy?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted/70">{title}</p>
      {drawn ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={drawn.src}
          alt={title}
          className="mt-1.5 w-full rounded-xl border border-hairline/60"
        />
      ) : (
        <div className="mt-1.5 flex h-40 items-center justify-center rounded-xl border border-dashed border-hairline text-xs text-muted">
          {busy ? "Drawing…" : "—"}
        </div>
      )}
      {drawn && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-2xs text-muted/70">What was sent</summary>
          <p className="mt-1 text-2xs leading-4 text-muted">{drawn.prompt}</p>
        </details>
      )}
    </div>
  );
}

/** A person who exists only for this bench — never written to the store. */
function scratch(name: string): WorldMember {
  const m = newMember("person", name);
  m.face = randomFace();
  return m;
}

async function draw(prompt: string): Promise<string> {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = (await res.json()) as { image?: string; error?: string; hint?: string };
  if (!res.ok || !data.image) {
    throw new Error([data.error, data.hint].filter(Boolean).join(" ") || `Failed (${res.status}).`);
  }
  return data.image;
}
