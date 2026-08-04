"use client";

import Nav from "./Nav";

/**
 * The page's own fixed bar, sitting directly under the header.
 *
 * Everything in it is one uniform height and vertically centred, so the
 * greeting no longer towers over the controls beside it. On a laptop it is a
 * single row — greeting, the page's controls, then the tabs. On a phone the
 * tabs take their own centred row with the greeting and controls beneath, the
 * order they've always been in.
 *
 * A spacer of matching height holds its place in the flow, so no page has to
 * know how tall the chrome is.
 */
export default function PageBar({
  heading,
  controls,
}: {
  heading?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  const hasRow = Boolean(heading || controls);

  return (
    <>
      <div className="fixed inset-x-0 top-16 z-30 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-5 lg:max-w-6xl">
          {/* Laptop and tablet: one line, everything aligned to its middle. */}
          <div className="hidden h-16 items-center justify-between gap-8 lg:flex">
            <div className="min-w-0 flex-1">{heading}</div>
            {controls && <div className="shrink-0">{controls}</div>}
            <Nav className="shrink-0" />
          </div>

          {/* Phone: tabs, then the greeting and controls on one line. */}
          <div className="lg:hidden">
            <div className="flex h-12 items-center justify-center">
              <Nav className="" />
            </div>
            {hasRow && (
              <div className="flex h-12 items-center justify-between gap-3">
                <div className="min-w-0 flex-1">{heading}</div>
                {controls && <div className="shrink-0">{controls}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div aria-hidden className={hasRow ? "h-24 lg:h-16" : "h-12 lg:h-16"} />
    </>
  );
}
