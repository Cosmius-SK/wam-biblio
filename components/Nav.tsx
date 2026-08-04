"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Timeline" },
  { href: "/gallery", label: "Gallery" },
  { href: "/ask", label: "Ask" },
];

/** Calm segmented control linking the three reading surfaces. */
export default function Nav({ className = "mx-auto mb-6 mt-1" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={`${className} flex w-fit gap-1 rounded-full border border-hairline/70 bg-surface/60 p-1 backdrop-blur-sm`}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink/90 text-paper shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
