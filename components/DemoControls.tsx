"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { db } from "@/lib/db";
import { seedDemoEntries, clearDemoEntries } from "@/lib/seed";

const demoCount = () => db.entries.where("id").startsWith("demo-").count();

/** Button to load the sample entries (shown in the empty state). */
export function SeedButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await seedDemoEntries();
      }}
      className="mt-3 inline-block rounded-full border border-hairline bg-surface/60 px-5 py-2 text-sm font-medium text-muted transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
    >
      {loading ? "Loading…" : "Preview with sample entries"}
    </button>
  );
}

/**
 * A slim banner shown whenever sample entries are present, with a one-tap
 * erase. This is how the demo data gets removed before real use.
 */
export function DemoBanner() {
  const count = useLiveQuery(demoCount);
  if (!count) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-lavender/30 bg-lavender/10 px-4 py-2.5 text-sm"
    >
      <span className="text-muted">
        Showing {count} sample {count === 1 ? "entry" : "entries"} — just a preview.
      </span>
      <button
        type="button"
        onClick={() => clearDemoEntries()}
        className="shrink-0 rounded-full px-3 py-1 font-medium text-lavender transition-colors hover:bg-lavender/15"
      >
        Clear samples
      </button>
    </motion.div>
  );
}
