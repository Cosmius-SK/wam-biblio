"use client";

import type { ViewMode } from "@/lib/views";

/** Segmented scroll/book switch shown beside the filter on Timeline & Gallery. */
export default function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex rounded-full border border-hairline/70 bg-surface/60 p-0.5">
      <Segment
        active={value === "scroll"}
        label="Timeline view"
        onClick={() => onChange("scroll")}
      >
        <path d="M4 6h16M4 12h16M4 18h10" />
      </Segment>
      <Segment active={value === "book"} label="Book view" onClick={() => onChange("book")}>
        <path d="M12 6c-1.5-1.3-3.6-2-6-2v14c2.4 0 4.5.7 6 2 1.5-1.3 3.6-2 6-2V4c-2.4 0-4.5.7-6 2Z" />
        <path d="M12 6v14" />
      </Segment>
    </div>
  );
}

function Segment({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
        active ? "bg-ink/90 text-paper shadow-soft" : "text-muted hover:text-ink"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}
