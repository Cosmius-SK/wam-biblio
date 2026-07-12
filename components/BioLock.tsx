"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  isBiometricEnabled,
  lockHintOn,
  markUnlocked,
  relock,
  sessionUnlocked,
  verifyBiometric,
} from "@/lib/biometric";

/** Re-lock when the app was in the background longer than this. */
const RELOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * The biometric lock screen: covers the app on open (and after a long stint in
 * the background) until Face ID / fingerprint — or the app passcode — says
 * it's the owner. Solid backdrop on purpose: nothing behind it should be
 * readable while locked.
 */
export default function BioLock() {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hiddenAt = useRef<number | null>(null);

  async function attempt() {
    setError(null);
    setBusy(true);
    const ok = await verifyBiometric();
    setBusy(false);
    if (ok) {
      setLocked(false);
      setShowPass(false);
      setPass("");
    } else {
      setError("Didn't catch that — try again, or use your passcode.");
    }
  }

  useEffect(() => {
    // Fast local hint first, then verify against the real setting (covers a
    // cleared localStorage or a lock disabled from Settings). We do NOT
    // auto-prompt: browsers block WebAuthn without a user gesture, so the
    // owner taps "Unlock" — that avoids a spurious error on load.
    if (lockHintOn() && !sessionUnlocked()) {
      setLocked(true);
      void isBiometricEnabled().then((en) => {
        if (!en) setLocked(false);
      });
    }

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      if (
        hiddenAt.current !== null &&
        Date.now() - hiddenAt.current > RELOCK_AFTER_MS &&
        lockHintOn()
      ) {
        relock();
        setLocked(true);
      }
      hiddenAt.current = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ passcode: pass }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "That passcode doesn't match.");
      }
      markUnlocked();
      setLocked(false);
      setShowPass(false);
      setPass("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {locked && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-paper p-6"
          role="dialog"
          aria-label="Unlock biblio"
        >
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-6 h-14 w-14 animate-breathe rounded-full bg-gradient-to-br from-terracotta/40 via-lavender/40 to-sage/40" />
            <h1 className="font-serif text-2xl text-ink">biblio is locked</h1>
            <p className="mt-1 text-sm text-muted">Just making sure it&rsquo;s you.</p>

            {!showPass ? (
              <>
                <button
                  type="button"
                  onClick={attempt}
                  disabled={busy}
                  className="mt-7 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-50"
                >
                  {busy ? "Checking…" : "Unlock with Face ID / fingerprint"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowPass(true);
                  }}
                  className="mt-3 text-sm text-lavender underline-offset-2 hover:underline"
                >
                  Use passcode instead
                </button>
              </>
            ) : (
              <form onSubmit={submitPass} className="mt-7">
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoFocus
                  placeholder="passcode"
                  className="w-full rounded-full border border-hairline bg-surface/70 px-5 py-3 text-center text-ink placeholder:text-muted/60 focus:border-lavender/60"
                />
                <button
                  type="submit"
                  disabled={busy || !pass}
                  className="mt-4 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
                >
                  {busy ? "Opening…" : "Come in"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowPass(false);
                  }}
                  className="mt-3 text-sm text-muted underline-offset-2 hover:underline"
                >
                  Back to Face ID / fingerprint
                </button>
              </form>
            )}

            {error && <p className="mt-4 text-sm text-terracotta">{error}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
