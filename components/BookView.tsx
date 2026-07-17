"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Book view — a real journal to leaf through. Every page is the same fixed
 * paper frame (spine shading, book corners), and turning is a true page-turn
 * around the spine.
 *
 * With `paginate`, an entry longer than one page FLOWS onto further leaves —
 * no scrollbars. The trick: the content is laid out in CSS columns exactly one
 * page wide/tall (the browser splits at line boundaries, keeps images whole),
 * and each leaf shows one column; turning a leaf uses the same page-turn as
 * moving between entries, so a 3-page entry reads like three pages of a book.
 */
const GAP = 48; // px between column-pages; anything > 0 keeps leaves cleanly apart

export default function BookView<T>({
  items,
  keyOf,
  renderPage,
  paginate = false,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderPage: (item: T, index: number) => React.ReactNode;
  /** Flow long content onto further leaves (Timeline); off = page must fit (Gallery). */
  paginate?: boolean;
}) {
  const [nav, setNav] = useState<{
    turn: number;
    item: number;
    leaf: number | "last";
    dir: number;
  }>({ turn: 0, item: 0, leaf: 0, dir: 0 });
  const [leafCount, setLeafCount] = useState(1);

  // Items can shrink (filter change, deletion) — stay on a real page.
  useEffect(() => {
    if (nav.item > items.length - 1) {
      setNav((n) => ({ ...n, item: Math.max(0, items.length - 1), leaf: 0 }));
    }
  }, [items.length, nav.item]);

  if (items.length === 0) return null;
  const itemIdx = Math.min(nav.item, items.length - 1);
  const item = items[itemIdx];
  const leaf =
    nav.leaf === "last"
      ? Math.max(0, leafCount - 1)
      : Math.min(nav.leaf, Math.max(0, leafCount - 1));

  function go(delta: number) {
    if (delta > 0) {
      if (paginate && leaf + 1 < leafCount) {
        setNav((n) => ({ turn: n.turn + 1, item: itemIdx, leaf: leaf + 1, dir: 1 }));
      } else if (itemIdx < items.length - 1) {
        setNav((n) => ({ turn: n.turn + 1, item: itemIdx + 1, leaf: 0, dir: 1 }));
      }
    } else {
      if (paginate && leaf > 0) {
        setNav((n) => ({ turn: n.turn + 1, item: itemIdx, leaf: leaf - 1, dir: -1 }));
      } else if (itemIdx > 0) {
        setNav((n) => ({ turn: n.turn + 1, item: itemIdx - 1, leaf: "last", dir: -1 }));
      }
    }
  }

  const atStart = itemIdx === 0 && leaf === 0;
  const atEnd = itemIdx === items.length - 1 && (!paginate || leaf >= leafCount - 1);

  const turnT = { duration: 0.6, ease: [0.35, 0.15, 0.25, 1] as const };
  const variants = {
    enter: (d: number) => (d >= 0 ? { rotateY: 0, zIndex: 1 } : { rotateY: -105, zIndex: 3 }),
    center: (d: number) => ({
      rotateY: 0,
      zIndex: d >= 0 ? 1 : 3,
      transition: d >= 0 ? { duration: 0 } : turnT,
    }),
    exit: (d: number) =>
      d >= 0
        ? { rotateY: -105, zIndex: 3, transition: turnT }
        : { rotateY: 0, zIndex: 1, transition: { duration: turnT.duration } },
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
        <AnimatePresence custom={nav.dir} initial={false}>
          <motion.div
            key={nav.turn}
            custom={nav.dir}
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
            {paginate ? (
              <Leaf
                leaf={nav.leaf}
                onCount={(c) => {
                  setLeafCount(c);
                  setNav((n) => {
                    if (n.leaf === "last") return { ...n, leaf: Math.max(0, c - 1) };
                    if (typeof n.leaf === "number" && n.leaf > c - 1)
                      return { ...n, leaf: Math.max(0, c - 1) };
                    return n;
                  });
                }}
              >
                {renderPage(item, itemIdx)}
              </Leaf>
            ) : (
              <div className="h-full overflow-hidden">{renderPage(item, itemIdx)}</div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <PageArrow flip={false} disabled={atStart} onClick={() => go(-1)} />
        <span className="text-sm tabular-nums text-muted">
          {itemIdx + 1} <span className="text-muted/60">/ {items.length}</span>
          {paginate && leafCount > 1 && (
            <span className="text-muted/60">
              {" "}
              · page {leaf + 1}/{leafCount}
            </span>
          )}
        </span>
        <PageArrow flip disabled={atEnd} onClick={() => go(1)} />
      </div>
      <p className="mt-2 text-center text-xs text-muted/60">Swipe, or use the arrows.</p>
    </div>
  );
}

/**
 * One visible page of a multi-leaf entry. Content flows through CSS columns
 * sized exactly one page each; showing leaf N is a translate to column N.
 * Measured before paint, re-measured on resize; the leaf count is reported up
 * so navigation knows when the entry runs onto more pages.
 */
function Leaf({
  leaf,
  onCount,
  children,
}: {
  leaf: number | "last";
  onCount: (count: number) => void;
  children: React.ReactNode;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [pageW, setPageW] = useState(0);
  const [count, setCount] = useState(1);
  const reported = useRef(0);

  useLayoutEffect(() => {
    const el = colRef.current;
    if (!el) return;
    const measure = () => setPageW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = colRef.current;
    if (!el || !pageW) return;
    const c = Math.max(1, Math.round((el.scrollWidth + GAP) / (pageW + GAP)));
    setCount(c);
    if (reported.current !== c) {
      reported.current = c;
      onCount(c);
    }
  }, [pageW, children, onCount]);

  const offset = Math.min(leaf === "last" ? count - 1 : leaf, count - 1);

  return (
    <div className="h-full overflow-hidden py-7 pl-10 pr-7">
      <div
        ref={colRef}
        className="h-full [&_img]:[break-inside:avoid]"
        style={
          pageW
            ? {
                columnWidth: pageW,
                columnGap: GAP,
                columnFill: "auto",
                transform: `translateX(-${offset * (pageW + GAP)}px)`,
              }
            : undefined
        }
      >
        {children}
      </div>
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
