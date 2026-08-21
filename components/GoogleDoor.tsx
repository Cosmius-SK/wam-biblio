"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { driveConfigured, getAccessToken } from "@/lib/drive";
import { describeDevice } from "@/lib/deviceId";

/**
 * The front door: sign in with Google.
 *
 * The token never becomes proof on its own — it goes to /api/auth/session,
 * which asks Google who it belongs to and checks the list before issuing a
 * session. Someone not on the list gets a warm sentence, not a stack trace.
 */
export default function GoogleDoor({ next = "/", invite }: { next?: string; invite?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = driveConfigured();

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device: describeDevice(), invite }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again?");
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again?");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted">
        Google sign-in isn&rsquo;t set up on this deployment yet.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
      >
        {busy ? "One moment…" : "Continue with Google"}
      </button>
      {error && (
        <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</p>
      )}
    </div>
  );
}
