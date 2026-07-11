"use client";

import { useEffect, useState } from "react";
import {
  biometricSupported,
  disableBiometric,
  enrollBiometric,
  isBiometricEnabled,
} from "@/lib/biometric";

/**
 * Settings › App lock: turn the per-device biometric lock on or off. The app
 * passcode always remains as the fallback, so this can never lock the owner
 * out.
 */
export default function AppLockCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setSupported(await biometricSupported());
      setEnabled(await isBiometricEnabled());
    })();
  }, []);

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await disableBiometric();
        setEnabled(false);
      } else {
        await enrollBiometric();
        setEnabled(true);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "That was cancelled — try again when you're ready."
          : err instanceof Error
            ? err.message
            : "Couldn't set up the lock.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) return null;

  return (
    <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">App lock</h2>
        {supported && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              enabled
                ? "bg-lavender/15 text-lavender"
                : "border border-hairline text-muted hover:text-ink"
            } disabled:opacity-50`}
          >
            {busy ? "…" : enabled ? "On" : "Turn on"}
          </button>
        )}
      </div>
      {supported ? (
        <p className="mt-1 text-sm text-muted">
          {enabled
            ? "This device asks for Face ID / fingerprint when biblio opens (and after a while in the background). Your passcode always works as the fallback."
            : "Ask for Face ID / fingerprint when biblio opens on this device. Your passcode stays as the fallback."}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          This device doesn&rsquo;t offer Face ID / fingerprint in the browser — the app
          passcode keeps guarding the door.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}
