"use client";

import { useCallback, useEffect, useState } from "react";

interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface Report {
  checkedAt: number;
  version: string;
  build: string;
  ok: boolean;
  checks: Check[];
}

/**
 * Owner-only connection check.
 *
 * Every link that can silently break is exercised for real — a one-token call
 * to Anthropic, a free model listing from Gemini, a write-and-read-back
 * against the Blob store — and reports the actual error. Rotating a key is
 * exactly when this matters, and exactly when nobody wants to find out by
 * writing an entry and watching it fail.
 */
export default function HealthCard() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't run the checks (${res.status}).`);
      setReport((await res.json()) as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the checks.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="rounded-2xl border border-hairline/60 bg-surface/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-ink">Connections</h2>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run checks"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

      {report && (
        <>
          <p className="mt-1 text-xs text-muted">
            v{report.version}
            {report.build ? ` · build ${report.build}` : ""} ·{" "}
            {report.ok ? "everything answering" : "something needs attention"}
          </p>

          <ul className="mt-4 space-y-2.5">
            {report.checks.map((c) => (
              <li key={c.id} className="flex gap-3">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    c.ok ? "bg-sage" : "bg-terracotta"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm text-ink/90">
                    {c.label}
                    <span className="sr-only">{c.ok ? " — working" : " — not working"}</span>
                  </p>
                  <p className="break-words font-mono text-xs leading-relaxed text-muted">
                    {c.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted/70">
        The Anthropic check makes one real request with a single token of output — a fraction
        of a cent, and the only way to know a key genuinely works. Nothing here prints a
        secret.
      </p>
    </div>
  );
}
