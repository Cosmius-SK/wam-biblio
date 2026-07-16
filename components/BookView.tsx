"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Book view — a real journal to leaf through. Every page is the same fixed
 * paper frame (uniform size, spine shading, small folio corners), and turning
 * is a true page-turn: the page rotates around the spine (left edge) under
 * perspective, revealing the next page beneath — not a slide.
 *
 * Forward: the current page lifts and turns away on top (z=3) while the next
 * sits static beneath (z=1). Backward: the previous page turns back IN on top.
 * Pages never animate their own content (renderPage output is static), which
 * is what keeps the turn clean.
 */
export default function BookView<T>({
  items,
  keyOf,
  renderPage,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderPage: (item: T, index: number) => React.ReactNode;
}) {
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);

  // Items can shrink (filter change, deletion) — stay on a real page.
  useEffect(() => {
    if (index > items.length - 1) setPage([Math.max(0, items.length - 1), 0]);
  }, [items.length, index]);

  if (items.length === 0) return null;
  const clamped = Math.min(index, items.length - 1);
  const item = items[clamped];

  function go(delta: number) {
    const next = clamped + delta;
    if (next < 0 || next > items.length - 1) return;
    setPage([next, delta]);
  }

  const turn = { duration: 0.6, ease: [0.35, 0.15, 0.25, 1] as const };
  const variants = {
    // Forward: the incoming page is simply there, beneath. Backward: it turns in.
    enter: (d: number) =>
      d >= 0 ? { rotateY: 0, zIndex: 1 } : { rotateY: -105, zIndex: 3 },
    center: (d: number) => ({
      rotateY: 0,
      zIndex: d >= 0 ? 1 : 3,
      transition: d >= 0 ? { duration: 0 } : turn,
    }),
    // Forward: the outgoing page turns away, on top. Backward: it just waits
    // beneath until the turn above finishes, then unmounts.
    exit: (d: number) =>
      d >= 0
        ? { rotateY: -105, zIndex: 3, transition: turn }
        : { rotateY: 0, zIndex: 1, transition: { duration: turn.duration } },
  };

  return (
    <div>
      <motion.div
        className="relative mx-auto h-[64vh] max-w-[30rem] [perspective:1800px]"
        style={{ touchAction: "pan-y" }}
        onPanEnd={(_, info) => {
          if (Math.abs(info.offset.x) < 60 || Math.abs(info.offset.x) < Math.abs(info.offset.y))
            return;
          go(info.offset.x < 0 ? 1 : -1);
        }}
      >
        <AnimatePresence custom={dir} initial={false}>
          <motion.div
            key={keyOf(item)}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 overflow-hidden rounded-r-xl rounded-l-md border border-hairline/70 bg-paper shadow-lift"
            style={{
              transformOrigin: "left center",
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Spine shading — the page belongs to a bound book. */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-ink/15 via-ink/5 to-transparent" />
            <div className="h-full overflow-y-auto overscroll-contain">
              {renderPage(item, clamped)}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <PageArrow flip={false} disabled={clamped === 0} onClick={() => go(-1)} />
        <span className="text-sm tabular-nums text-muted">
          {clamped + 1} <span className="text-muted/60">/ {items.length}</span>
        </span>
        <PageArrow flip disabled={clamped === items.length - 1} onClick={() => go(1)} />
      </div>
      <p className="mt-2 text-center text-xs text-muted/60">Swipe, or use the arrows.</p>
    </div>
  );
}

function PageArrow({
  flip,
  disabled,
  onClick,
}: {
  flip: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={flip ? "Next page" : "Previous page"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface/60 text-muted transition-colors enabled:hover:text-ink disabled:opacity-30"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={flip ? "" : "rotate-180"}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
