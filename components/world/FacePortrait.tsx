"use client";

import { pick, isChild, HAIR_COLOURS, SKINS, type Face } from "@/lib/world/face";

/**
 * A person, drawn from their description.
 *
 * Flat shapes in biblio's own palette rather than a cartoon avatar: the point
 * is a portrait, which is understood to be an interpretation, not a profile
 * picture, which is understood to be a likeness. Nobody should look at this
 * and think it is meant to be photographic.
 *
 * Every shape is a pure function of the choices — no seeds, no randomness, no
 * network. The same description always draws the same person, on any device,
 * offline, for ever.
 *
 * Proportion does most of the work that colour cannot. A child is not a small
 * adult: rounder skull, eyes set lower and wider, a shorter face, narrower
 * shoulders. Get that wrong and every child in the cast looks forty.
 */
export default function FacePortrait({
  face,
  size = 120,
  className = "",
}: {
  face: Face;
  size?: number;
  className?: string;
}) {
  const skin = pick(SKINS, face.skin);
  const hair = pick(HAIR_COLOURS, face.hairColour);
  const young = isChild(face);

  const small = face.age === "small";
  const rx = small ? 18 : young ? 18.5 : 19.5;
  const ry = small ? 19 : young ? 20 : 23;
  const cy = young ? 42 : 44;
  const chin = cy + ry;
  const eyeY = small ? cy + 5 : young ? cy + 4.5 : cy + 2;
  const eyeX = young ? 6.5 : 6.7;
  const browY = eyeY - (young ? 6 : 5.5);
  const mouthY = young ? eyeY + 8.5 : eyeY + 11;
  const shoulder = ({ slight: 26, medium: 31, sturdy: 36 }[face.build] ?? 31) - (young ? 6 : 0);
  const neckTop = chin - 4;
  const ink = "#2A2622";

  /** Half-width of the head at a given height — every shape hangs off this. */
  const halfAt = (y: number) => {
    const t = Math.min(1, Math.abs(y - cy) / ry);
    return rx * Math.sqrt(Math.max(0, 1 - t * t));
  };

  /**
   * The crescent of hair over the skull. `sides` is how far down it reaches,
   * `top` how thick it is at the crown — which is the whole difference between
   * a full head of hair and a shaved one.
   */
  const cap = (sides: number, top: number) => {
    const w = halfAt(sides);
    return `M${50 - w} ${sides} A${rx} ${ry} 0 0 1 ${50 + w} ${sides} C ${50 + w - 2} ${top + 5}, ${50 + 11} ${top}, 50 ${top} C ${50 - 11} ${top}, ${50 - w + 2} ${top + 5}, ${50 - w} ${sides} Z`;
  };

  /** Everything below a line on the face: the shape a beard grows in. */
  const jaw = (from: number) => {
    const w = halfAt(from);
    return `M${50 - w} ${from} A${rx} ${ry} 0 0 0 ${50 + w} ${from} Z`;
  };

  /** Hair falling either side of the face, `depth` below the widest point. */
  const falls = (depth: number) =>
    `M${50 - rx - 1} ${cy - 3} C ${50 - rx - 4} ${cy + depth * 0.45}, ${50 - rx - 3} ${cy + depth * 0.75}, ${50 - rx + 1} ${cy + depth} C ${50 - 9} ${cy + depth * 0.84}, ${50 - 8} ${cy + depth * 0.45}, ${50 - 8} ${cy + 4} L ${50 + 8} ${cy + 4} C ${50 + 8} ${cy + depth * 0.45}, ${50 + 9} ${cy + depth * 0.84}, ${50 + rx - 1} ${cy + depth} C ${50 + rx + 3} ${cy + depth * 0.75}, ${50 + rx + 4} ${cy + depth * 0.45}, ${50 + rx + 1} ${cy - 3} Z`;

  const beard = face.facialHair;
  const bearded = !young && (beard === "stubble" || beard === "short" || beard === "full");
  const beardFrom = beard === "full" ? eyeY + 5 : beard === "short" ? eyeY + 7 : eyeY + 6;
  const moustache = !young && ["moustache", "short", "full"].includes(beard);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Portrait"
    >
      {/* The wash behind them — theme colours, so a portrait belongs to
          whatever light the app is in. */}
      <rect width="100" height="100" fill="rgb(var(--paper))" />
      <rect width="100" height="100" fill="rgb(var(--lavender) / 0.13)" />
      <ellipse cx="50" cy="97" rx="46" ry="30" fill="rgb(var(--sage) / 0.12)" />

      {/* Hair that falls behind the head has to be drawn before it. */}
      {(face.hair === "long" || face.hair === "wavy") && (
        // Two falls either side of the neck rather than one slab behind it —
        // a slab reads as a hood, and no amount of colour fixes that.
        <path d={falls(face.hair === "long" ? 40 : 26)} fill={hair.shade} />
      )}
      {face.hair === "tied" && <circle cx="50" cy={cy - ry - 3} r="7.5" fill={hair.shade} />}

      {/* Shoulders, then the neck, then the head over both. */}
      <path
        d={`M${50 - shoulder - 8} 100 C ${50 - shoulder} ${neckTop + 9}, ${50 - 12} ${neckTop + 3}, 50 ${neckTop + 3} C ${50 + 12} ${neckTop + 3}, ${50 + shoulder} ${neckTop + 9}, ${50 + shoulder + 8} 100 Z`}
        fill="rgb(var(--ink) / 0.7)"
      />
      <rect x="43.5" y={neckTop - 6} width="13" height="14" rx="6" fill={skin.shade} />
      <ellipse cx={50 - rx - 1.5} cy={cy + 3} rx="3.1" ry="4.4" fill={skin.shade} />
      <ellipse cx={50 + rx + 1.5} cy={cy + 3} rx="3.1" ry="4.4" fill={skin.shade} />
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={skin.hex} />

      {/* One soft shadow down a single side, so the face has a light source. */}
      <path
        d={`M50 ${cy - ry} A${rx} ${ry} 0 0 1 50 ${chin} Z`}
        fill={skin.shade}
        opacity="0.2"
      />

      {face.hair !== "bald" &&
        (face.hair === "shaved" ? (
          // A shadow of hair on the skull, not a band across the forehead.
          <path d={cap(cy - 7, cy - ry + 3.5)} fill={hair.hex} opacity="0.5" />
        ) : (
          <>
            <path d={cap(cy, cy - ry + (young ? 7 : 8))} fill={hair.hex} />
            {face.hair === "curls" &&
              [-16, -8, 0, 8, 16].map((dx, i) => (
                <circle
                  key={dx}
                  cx={50 + dx}
                  cy={cy - ry + (i === 2 ? 5 : 8)}
                  r="6"
                  fill={hair.hex}
                />
              ))}
          </>
        ))}

      <path
        d={`M${50 - eyeX - 3.4} ${browY} q3.4 -2 6.8 0`}
        stroke={hair.shade}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${50 + eyeX - 3.4} ${browY} q3.4 -2 6.8 0`}
        stroke={hair.shade}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx={50 - eyeX} cy={eyeY} rx="1.7" ry="2" fill={ink} />
      <ellipse cx={50 + eyeX} cy={eyeY} rx="1.7" ry="2" fill={ink} />
      <path
        d={`M49 ${eyeY + (young ? 2 : 3)} q-1.4 ${young ? 3 : 4} 1.8 ${young ? 3.6 : 4.8}`}
        stroke={skin.shade}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* A beard is a shape with a mouth left open in it. Filling the whole
          jaw and stopping there drew a mask over the face. */}
      {bearded && (
        <>
          <path
            d={jaw(beardFrom)}
            fill={hair.shade}
            opacity={beard === "stubble" ? 0.26 : 0.95}
          />
          {beard !== "stubble" && (
            <ellipse cx="50" cy={mouthY - 0.3} rx="6.2" ry="3.7" fill={skin.hex} opacity="0.9" />
          )}
        </>
      )}

      <path
        d={`M${50 - 4.5} ${mouthY} q4.5 ${young ? 2.6 : 3} 9 0`}
        stroke="#8A4B44"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />

      {moustache && (
        <path d={`M42 ${mouthY - 3.6} q8 -3 16 0 q-8 3.4 -16 0 Z`} fill={hair.shade} />
      )}

      {face.glasses !== "none" && (
        <g
          stroke={face.glasses === "wire" ? "#8C7F6C" : ink}
          strokeWidth={face.glasses === "wire" ? 0.9 : 1.2}
          fill="rgb(255 255 255 / 0.14)"
        >
          {face.glasses === "rect" ? (
            <>
              <rect x={50 - eyeX - 5.8} y={eyeY - 3.6} width="11.6" height="7.2" rx="1.8" />
              <rect x={50 + eyeX - 5.8} y={eyeY - 3.6} width="11.6" height="7.2" rx="1.8" />
            </>
          ) : (
            <>
              <circle cx={50 - eyeX} cy={eyeY} r="5.6" />
              <circle cx={50 + eyeX} cy={eyeY} r="5.6" />
            </>
          )}
          <path d={`M${50 - 1.2} ${eyeY - 0.5} h2.4`} fill="none" />
          <path d={`M${50 - eyeX - 5.8} ${eyeY - 1} l-4.5 -1.4`} fill="none" />
          <path d={`M${50 + eyeX + 5.8} ${eyeY - 1} l4.5 -1.4`} fill="none" />
        </g>
      )}
    </svg>
  );
}
