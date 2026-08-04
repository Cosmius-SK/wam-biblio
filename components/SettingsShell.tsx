"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/** Shared frame for a Settings sub-page: back link, title, blurb, content. */
export default function SettingsShell({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-2xl"
    >
      <Link
        href="/settings"
        className="mt-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
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
          <path d="m15 18-6-6 6-6" />
        </svg>
        Settings
      </Link>
      <h1 className="mt-3 font-serif text-3xl text-ink">{title}</h1>
      {blurb && <p className="mt-1 text-muted">{blurb}</p>}
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
