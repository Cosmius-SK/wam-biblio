"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import PageBar from "@/components/PageBar";

/**
 * Settings hub — iOS-style: a short list of categories, each opening a focused
 * sub-page, so the top level never becomes an infinite scroll.
 */
const SECTIONS: { href: string; title: string; desc: string }[] = [
  { href: "/settings/profile", title: "Profile", desc: "Your name and portrait timelapse." },
  { href: "/settings/maya", title: "Maya", desc: "Her voice, and how often she speaks up." },
  { href: "/settings/account", title: "Account & sync", desc: "Google sign-in, automatic sync." },
  { href: "/settings/ai", title: "AI", desc: "Live mode, illustration model & style, usage." },
  { href: "/settings/security", title: "Security", desc: "App lock with Face ID / fingerprint." },
  { href: "/settings/devices", title: "Devices", desc: "What holds a copy of your journal." },
  {
    href: "/settings/appearance",
    title: "Appearance & sound",
    desc: "Background mood and ambient music.",
  },
  { href: "/vault", title: "Backup & vault", desc: "Encrypted backup, passphrase sync, Drive." },
  { href: "/settings/about", title: "About biblio", desc: "Version, privacy, how it works." },
];

export default function SettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl"
    >
      <PageBar />
      <div className="mb-7 mt-4">
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-muted">Make it yours.</p>
      </div>

      <ul className="overflow-hidden rounded-2xl border border-hairline/70">
        {SECTIONS.map((s, i) => (
          <li key={s.href} className={i > 0 ? "border-t border-hairline/50" : ""}>
            <Link
              href={s.href}
              className="flex items-center justify-between gap-3 bg-surface/60 px-5 py-4 transition-colors hover:bg-surface"
            >
              <div>
                <p className="font-serif text-lg text-ink">{s.title}</p>
                <p className="text-sm text-muted">{s.desc}</p>
              </div>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 mt-8 px-1 text-xs font-medium uppercase tracking-wide text-muted/70">
        Coming soon
      </h3>
      <ul className="overflow-hidden rounded-2xl border border-hairline/60">
        {[
          ["Daily reminder", "A gentle nudge to write, at a time you pick."],
          ["Memories", "On-this-day and mood-curated stories from your past."],
          ["Export your journal", "Download everything as plain, readable files."],
        ].map(([title, desc], i) => (
          <li
            key={title}
            className={`flex items-center justify-between gap-3 bg-surface/40 px-5 py-4 ${
              i > 0 ? "border-t border-hairline/50" : ""
            }`}
          >
            <div>
              <p className="text-ink/80">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-lavender/10 px-2.5 py-0.5 text-xs font-medium text-lavender">
              Soon
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-muted"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
