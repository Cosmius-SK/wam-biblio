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
  const [drawing, setDrawing] = useState(false);
  const [image, setImage] = useState<{ src: string; model: string } | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

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

  /**
   * Listing models proves a key is valid; it does not prove anything can be
   * drawn with it. Quotas, safety filters and model availability all fail at
   * generation time — so the only honest test is to generate one, here, rather
   * than by writing a real entry and hoping.
   */
  async function draw() {
    setDrawing(true);
    setDrawError(null);
    setImage(null);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "A quiet desk by a window in soft morning light, an open notebook on it.",
        }),
      });
      const data = (await res.json()) as {
        image?: string;
        model?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok || !data.image) {
        throw new Error([data.error, data.hint].filter(Boolean).join(" ") || `Failed (${res.status}).`);
      }
      setImage({ src: data.image, model: data.model ?? "unknown" });
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : "Couldn't draw anything.");
    } finally {
      setDrawing(false);
    }
  }

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

      <div className="mt-5 border-t border-hairline/50 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void draw()}
            disabled={drawing}
            className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40 disabled:opacity-50"
          >
            {drawing ? "Drawing…" : "Draw a test image"}
          </button>
          <span className="text-xs text-muted/70">Generates one illustration · about 4¢</span>
        </div>

        {drawError && (
          <p className="mt-3 break-words rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {drawError}
          </p>
        )}

        {image && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the model */}
            <img
              src={image.src}
              alt="Test illustration"
              className="w-full max-w-xs rounded-xl border border-hairline/60"
            />
            <p className="mt-2 font-mono text-xs text-muted">drawn by {image.model}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted/70">
        The Anthropic check makes one real request with a single token of output — a fraction
        of a cent, and the only way to know a key genuinely works. The image test costs about
        4¢ and is the only way to know illustrations do. Nothing here prints a secret.
      </p>
    </div>
  );
}
