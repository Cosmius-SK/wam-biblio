"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

function UnlockCard() {
  const params = useSearchParams();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ passcode: value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Couldn't unlock.");
      }
      const from = params.get("from");
      const dest = from && from.startsWith("/") ? from : "/";
      // Hard navigation so middleware re-runs with the freshly-set auth cookie
      // (a client-side router.replace can loop back to /unlock).
      window.location.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock.");
      setBusy(false);
    }
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mx-auto mt-[18vh] max-w-sm rounded-2xl border border-hairline/70 bg-surface/70 p-8 text-center shadow-soft backdrop-blur-sm"
    >
      <div className="mx-auto mb-5 h-12 w-12 animate-breathe rounded-full bg-gradient-to-br from-terracotta/40 via-lavender/40 to-sage/40" />
      <h1 className="font-serif text-2xl text-ink">A quiet, private place</h1>
      <p className="mt-1 text-sm text-muted">Enter your passcode to come in.</p>

      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        placeholder="passcode"
        className="mt-6 w-full rounded-full border border-hairline bg-paper/60 px-5 py-3 text-center text-ink placeholder:text-muted/60 focus:border-lavender/60"
      />

      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

      <button
        type="submit"
        disabled={busy || !value}
        className="mt-5 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
      >
        {busy ? "Opening…" : "Come in"}
      </button>
    </motion.form>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <UnlockCard />
    </Suspense>
  );
}
