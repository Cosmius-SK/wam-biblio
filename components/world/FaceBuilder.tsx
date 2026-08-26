"use client";

import {
  AGES,
  BUILDS,
  FACIAL_HAIR,
  GLASSES,
  HAIR,
  HAIR_COLOURS,
  PRESENTS,
  SKINS,
  describeFace,
  isChild,
  randomFace,
  type Choice,
  type Face,
} from "@/lib/world/face";
import FacePortrait from "./FacePortrait";
import Framed from "./Framed";

/**
 * Choosing a face, rather than describing one.
 *
 * Everything here is one tap, the portrait redraws on the same frame, and
 * there is a shuffle for getting near by luck — which is quicker than working
 * down eight questions and is the difference between this feeling like play
 * and feeling like a form. A form nobody fills in takes the feature with it.
 *
 * The sentence at the bottom is not decoration. It is exactly what will be
 * sent when a picture is drawn, shown at the moment the choices are made, so
 * nobody has to take our word for what leaves the device.
 */
export default function FaceBuilder({
  face,
  onChange,
}: {
  face: Face;
  onChange: (face: Face) => void;
}) {
  const young = isChild(face);

  function set(key: keyof Face, value: string) {
    const next = { ...face, [key]: value };
    // A four-year-old with a full beard is a bug, not a choice.
    if (isChild(next)) next.facialHair = "none";
    onChange(next);
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-3">
        <Framed size={148}>
          <FacePortrait face={face} size={148} />
        </Framed>
        <button
          type="button"
          onClick={() => onChange(randomFace())}
          className="rounded-full border border-hairline bg-paper/50 px-4 py-1.5 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Shuffle
        </button>
      </div>

      <Row label="Described as" list={PRESENTS} value={face.presents} onPick={(v) => set("presents", v)} />
      <Row label="Age" list={AGES} value={face.age} onPick={(v) => set("age", v)} />
      <Row label="Skin" list={SKINS} value={face.skin} onPick={(v) => set("skin", v)} swatch />
      <Row label="Hair" list={HAIR} value={face.hair} onPick={(v) => set("hair", v)} />
      {face.hair !== "bald" && (
        <Row
          label="Hair colour"
          list={HAIR_COLOURS}
          value={face.hairColour}
          onPick={(v) => set("hairColour", v)}
          swatch
        />
      )}
      {!young && (
        <Row
          label="Facial hair"
          list={FACIAL_HAIR}
          value={face.facialHair}
          onPick={(v) => set("facialHair", v)}
        />
      )}
      <Row label="Glasses" list={GLASSES} value={face.glasses} onPick={(v) => set("glasses", v)} />
      <Row label="Build" list={BUILDS} value={face.build} onPick={(v) => set("build", v)} />

      <div className="mt-5 rounded-xl border border-hairline/70 bg-paper/40 p-3">
        <p className="text-xs uppercase tracking-wide text-muted/70">What a picture is told</p>
        <p className="mt-1 text-sm text-ink/80">{describeFace(face)}</p>
        <p className="mt-1.5 text-2xs text-muted/70">
          Their name stays here. Only the description above ever goes with a picture.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  list,
  value,
  onPick,
  swatch = false,
}: {
  label: string;
  list: Choice[];
  value: string;
  onPick: (key: string) => void;
  swatch?: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wide text-muted/70">{label}</p>
      {/* One horizontal line per question: the whole builder stays a screen
          you flick through rather than a page you scroll down. */}
      <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1.5">
        {list.map((c) => {
          const active = c.key === value;
          if (swatch) {
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onPick(c.key)}
                aria-label={c.label}
                aria-pressed={active}
                className={`h-8 w-8 flex-none rounded-full border-2 transition-transform ${
                  active ? "scale-110 border-ink/50" : "border-hairline/60 hover:border-ink/25"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          }
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c.key)}
              aria-pressed={active}
              className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-lavender/60 bg-lavender/10 text-ink"
                  : "border-hairline bg-paper/40 text-muted hover:border-lavender/30"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
