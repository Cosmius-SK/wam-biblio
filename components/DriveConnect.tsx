"use client";

import { useEffect, useState } from "react";
import { connectDrive, disconnectDrive, driveConfigured, isDriveConnected } from "@/lib/drive";

/** The vault card that connects this device to the user's Google Drive. */
export default function DriveConnect() {
  const [state, setState] = useState<"loading" | "unconfigured" | "disconnected" | "connected">(
    "loading",
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!driveConfigured()) {
        if (!cancelled) setState("unconfigured");
        return;
      }
      const connected = await isDriveConnected();
      if (!cancelled) setState(connected ? "connected" : "disconnected");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await connectDrive();
      setState("connected");
      setNote(
        "Connected. Photos are encrypted on this device, then stored in a private “biblio-journal” folder in your Drive.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect Google Drive.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setNote(null);
    await disconnectDrive();
    setState("disconnected");
    setBusy(false);
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">Photos on Google Drive</h2>
        {state === "connected" && (
          <span className="rounded-full bg-sage/15 px-2.5 py-0.5 text-xs font-medium text-sage">
            Connected
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Photo attachments live in your own Drive, encrypted before upload — Google only ever sees
        ciphertext, and the app can only touch files it created.
      </p>

      {state === "unconfigured" && (
        <p className="mt-3 rounded-xl bg-lavender/10 px-4 py-3 text-xs text-muted">
          Setup needed: add <code className="text-lavender">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to
          the deployment and redeploy (see README for the one-time Google setup).
        </p>
      )}

      {(state === "disconnected" || state === "connected") && (
        <button
          type="button"
          onClick={state === "connected" ? disconnect : connect}
          disabled={busy}
          className={
            state === "connected"
              ? "mt-4 rounded-full border border-hairline bg-paper/50 px-5 py-2.5 text-sm font-medium text-ink transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
              : "mt-4 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          }
        >
          {busy ? "Working…" : state === "connected" ? "Disconnect this device" : "Connect Google Drive"}
        </button>
      )}

      {note && <p className="mt-3 rounded-xl bg-sage/15 px-4 py-3 text-sm text-sage">{note}</p>}
      {error && (
        <p className="mt-3 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</p>
      )}
    </div>
  );
}
