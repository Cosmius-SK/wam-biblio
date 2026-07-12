"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Book view: one item per page, turned by a swipe or the arrows — the journal
 * read as the book it is. A soft x-slide with a hint of page-curl (rotateY
 * under perspective) keeps it fluid without fighting readability.
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

  return (
    <div>
      <div className="relative [perspective:1400px]">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={keyOf(item)}
            custom={dir}
            variants={{
              enter: (d: number) => ({
                x: d >= 0 ? 90 : -90,
                opacity: 0,
                rotateY: d >= 0 ? -12 : 12,
              }),
              center: { x: 0, opacity: 1, rotateY: 0 },
              exit: (d: number) => ({
                x: d >= 0 ? -90 : 90,
                opacity: 0,
                rotateY: d >= 0 ? 12 : -12,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -400) go(1);
              else if (info.offset.x > 70 || info.velocity.x > 400) go(-1);
            }}
            style={{ transformStyle: "preserve-3d" }}
            className="cursor-grab active:cursor-grabbing"
          >
            {renderPage(item, clamped)}
          </motion.div>
        </AnimatePresence>
      </div>

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
