"use client";

import Nav from "./Nav";

/**
 * The page's top line — on a laptop or tablet only.
 *
 * One row across the full width: the greeting on the left, the page's own
 * controls (filter, view toggle) in the middle, and the tabs on the right.
 * A phone keeps exactly the layout it had — heading, then controls, with the
 * tabs centred by the root layout — so nothing about the mobile design moves.
 *
 * Both arrangements are rendered and one is hidden with CSS rather than
 * chosen in JS, so there's no flash of the wrong layout on load.
 */
export default function PageBar({
  heading,
  controls,
}: {
  heading?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-8 hidden items-end justify-between gap-8 pt-3 lg:flex">
        <div className="min-w-0 flex-1">{heading}</div>
        {controls && <div className="shrink-0">{controls}</div>}
        <Nav className="shrink-0" />
      </div>

      <div className="lg:hidden">
        {heading}
        {controls}
      </div>
    </>
  );
}
