"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/** The footer's quiet quote of the day — life, kindness, gratitude. */
export default function FooterQuote() {
  const [quote, setQuote] = useState<{ q: string; a: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { q?: string; a?: string } | null) => {
        if (!cancelled && d?.q && d.a) setQuote({ q: d.q, a: d.a });
      })
      .catch(() => {
        /* footer stays quiet */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quote) return null;

  return (
    <motion.figure
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="mx-auto max-w-md"
    >
      <blockquote className="sweep-text font-serif text-sm italic leading-relaxed">
        &ldquo;{quote.q}&rdquo;
      </blockquote>
      <figcaption className="mt-1.5 text-xs text-muted/70">— {quote.a}</figcaption>
    </motion.figure>
  );
}
