"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * A portrait on a shelf, not a contact avatar.
 *
 * The frame is doing real work. A profile picture is understood to be a
 * likeness and is judged as one; a framed portrait is understood to be an
 * interpretation, which is exactly what this is and all it can ever be. It
 * also suits an app that already thinks of itself as a book.
 *
 * Tapping turns it over. The description on the back is the half that actually
 * reaches a picture, so it should be one tap away and never hidden in an edit
 * screen — you should be able to see what biblio will say about someone.
 */
export default function Framed({
  children,
  back,
  caption,
  size = 120,
  onClick,
}: {
  children: React.ReactNode;
  /** The description underneath. Omit and the frame doesn't turn. */
  back?: string;
  caption?: string;
  size?: number;
  onClick?: () => void;
}) {
  const [turned, setTurned] = useState(false);
  const canTurn = !!back && !onClick;

  return (
    <figure className="flex flex-col items-center gap-2">
      <div style={{ perspective: 700 }}>
        <motion.button
          type="button"
          onClick={() => (onClick ? onClick() : canTurn && setTurned((t) => !t))}
          animate={{ rotateY: turned ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          aria-label={canTurn ? (turned ? "Show the portrait" : "Show the description") : caption}
          className="relative block rounded-[0.4rem] border-[3px] border-ink/25 bg-paper p-1.5 shadow-page transition-shadow hover:shadow-lift"
          style={{ transformStyle: "preserve-3d", width: size + 18, height: size + 18 }}
        >
          <span
            className="absolute inset-1.5 block overflow-hidden rounded-[0.2rem]"
            style={{ backfaceVisibility: "hidden" }}
          >
            {children}
          </span>
          <span
            className="absolute inset-1.5 flex items-center overflow-hidden rounded-[0.2rem] bg-surface px-2 text-left"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="text-2xs leading-4 text-muted">{back}</span>
          </span>
        </motion.button>
      </div>
      {caption && (
        <figcaption className="max-w-[9rem] truncate text-center text-sm text-ink/80">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
