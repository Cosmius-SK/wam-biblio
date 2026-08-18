"use client";

import { useCallback, useEffect, useState } from "react";
import { agoLabel } from "@/lib/format";
import { deviceId } from "@/lib/deviceId";

interface DeviceRow {
  id: string;
  label: string;
  platform: string;
  firstSeen: number;
  lastSeen: number;
  revokedAt?: number;
}

/**
 * Settings › Devices. Mostly this exists to be looked at: noticing that
 * something signed in last Tuesday from somewhere you weren't is the whole
 * value, and it is impossible without a list.
 *
 * Disconnect is described as what it actually is. We can stop a device syncing
 * and ask it to clear itself when it is next opened; we cannot reach a phone
 * that never gets opened again. Saying "remote wipe" would be the one
 * dishonest thing in an app whose pitch is that it doesn't lie about privacy.
 */
export default function DevicesCard() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mine = typeof window === "undefined" ? "" : deviceId();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/devices");
      if (res.status === 401) {
        setDevices([]);
        setError("Sign in with Google to see your devices.");
        return;
      }
      const data = (await res.json()) as { devices?: DeviceRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't read your devices.");
      setDevices(data.devices ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read your devices.");
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "revoke" | "forget") {
    setBusy(id);
    try {
      await fetch(`/api/auth/devices?id=${encodeURIComponent(id)}${action === "forget" ? "&forget=1" : ""}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function rename(id: string, label: string) {
    await fetch("/api/auth/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label }),
    });
    await load();
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Your devices</h2>
      <p className="mt-1 text-sm text-muted">
        Every device you&rsquo;ve signed in on keeps its own copy of your journal. This is
        the list of them.
      </p>

      {devices === null && <p className="mt-4 text-sm text-muted">Looking…</p>}

      {devices !== null && devices.length === 0 && (
        <p className="mt-4 text-sm text-muted">{error ?? "Nothing signed in yet."}</p>
      )}

      {devices !== null && devices.length > 0 && (
        <ul className="mt-4 space-y-3">
          {devices.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-hairline/60 bg-paper/50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{d.label}</span>
                {d.id === mine && (
                  <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs text-sage">
                    this one
                  </span>
                )}
                {d.revokedAt && (
                  <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-xs text-terracotta">
                    disconnected
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Last seen {agoLabel(d.lastSeen)} · added {agoLabel(d.firstSeen)}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt("Call this device:", d.label);
                    if (next) void rename(d.id, next);
                  }}
                  className="text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Rename
                </button>
                {!d.revokedAt && d.id !== mine && (
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => void act(d.id, "revoke")}
                    className="text-terracotta underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
                {d.revokedAt && (
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => void act(d.id, "forget")}
                    className="text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
                  >
                    Remove from list
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted/80">
        <strong className="font-medium text-muted">What disconnecting does.</strong> It stops
        that device syncing and asks it to clear itself the next time it&rsquo;s opened. It
        can&rsquo;t reach a phone that&rsquo;s switched off or never opened again — that copy
        stays until it is. Your phone&rsquo;s own lock screen is the real protection.
      </p>
    </div>
  );
}
