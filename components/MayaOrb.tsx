"use client";

import { useEffect, useRef, useState } from "react";
import { maya } from "@/lib/maya";

/**
 * Maya, as far as anyone can see her.
 *
 * She has no face and shouldn't get one — the moment you draw eyes you have
 * made a mascot, and she is not that. What makes something feel alive without
 * a face is breath and timing: mostly very still, and then a clear change when
 * there is something to say.
 *
 * That stillness is the point. An orb that is always busy becomes a
 * screensaver, and a screensaver is easier to ignore than a quiet thing that
 * suddenly moves. Her aliveness comes from contrast, not from activity.
 *
 * While she speaks the orb moves **with the words** — `maya.onPulse` fires per
 * word boundary — rather than looping in the background at the same time.
 */
export type OrbState = "resting" | "speaking" | "thinking" | "bloom";

export default function MayaOrb({
  size = 24,
  state,
  className = "",
}: {
  /** Pixels. The membrane and glow scale with it. */
  size?: number;
  /** Overrides the speaking state she reports herself. */
  state?: OrbState;
  className?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [scale, setScale] = useState(1);
  const relax = useRef<number | null>(null);

  useEffect(() => {
    const unSpeak = maya.onSpeaking(setSpeaking);
    const unPulse = maya.onPulse(() => {
      // A breath in on the word, and a slower one out — the timing of a person
      // speaking, not of a notification blinking.
      setScale(1.14);
      if (relax.current) window.clearTimeout(relax.current);
      relax.current = window.setTimeout(() => setScale(1), 130);
    });
    return () => {
      unSpeak();
      unPulse();
      if (relax.current) window.clearTimeout(relax.current);
    };
  }, []);

  const mode: OrbState = state ?? (speaking ? "speaking" : "resting");

  return (
    <span
      aria-hidden
      className={`maya-orb maya-orb--${mode} ${className}`}
      style={{
        width: size,
        height: size,
        // Only transform and opacity change, so this stays on one composited
        // layer however small the device.
        transform: `scale(${mode === "speaking" ? scale : 1})`,
      }}
    >
      <span className="maya-orb__membrane" />
      <span className="maya-orb__light" />
      <span className="maya-orb__glow" />
    </span>
  );
}
