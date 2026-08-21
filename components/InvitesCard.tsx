"use client";

import { useCallback, useEffect, useState } from "react";
import { agoLabel } from "@/lib/format";

interface Invite {
  id: string;
  note: string;
  createdAt: number;
  uses: number;
  used: number;
  expiresAt: number;
  revokedAt?: number;
  accepted: string[];
}

/**
 * Owner-only: who is in, and how to let someone else in.
 *
 * A link rather than an address, because the alternative is a person waiting
 * for the owner to be awake — and nobody's first impression of a journal
 * should be a delay.
 */
export default function InvitesCard() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [uses, setUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invites", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't read your invitations.");
      const d = (await res.json()) as { invites?: Invite[]; allowed?: string[] };
      setInvites(d.invites ?? []);
      setAllowed(d.allowed ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read your invitations.");
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkFor = (id: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/welcome?i=${id}`;

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, uses, days: 14 }),
      });
      const d = (await res.json()) as { invite?: Invite; error?: string };
      if (!res.ok || !d.invite) throw new Error(d.error || "Couldn't make a link.");
      setNote("");
      await copy(d.invite.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make a link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(linkFor(id));
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      /* clipboard blocked — the link is on screen to select by hand */
    }
  }

  async function remove(q: string) {
    await fetch(`/api/invites?${q}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="rounded-2xl border border-hairline/60 bg-surface/60 p-5">
      <h2 className="font-serif text-xl text-ink">Letting people in</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Send a link. Whoever opens it signs in with their own Google account and is straight
        in — no waiting on you, and no one else can follow.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who's it for? (just for your own notes)"
          className="min-w-0 flex-1 rounded-xl border border-hairline bg-paper/50 px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-lavender/60 focus:outline-none"
        />
        <select
          value={uses}
          onChange={(e) => setUses(Number(e.target.value))}
          aria-label="How many people may use this link"
          className="rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-sm text-ink focus:outline-none"
        >
          <option value={1}>1 person</option>
          <option value={3}>3 people</option>
          <option value={10}>10 people</option>
        </select>
        <button
          type="button"
          onClick={() => void make()}
          disabled={busy}
          className="rounded-full bg-ink/90 px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {busy ? "Making…" : "Make a link"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

      {invites && invites.length > 0 && (
        <ul className="mt-4 space-y-2">
          {invites.map((i) => {
            const dead = !!i.revokedAt || i.used >= i.uses || i.expiresAt < Date.now();
            return (
              <li
                key={i.id}
                className={`rounded-xl border border-hairline/60 bg-paper/40 p-3 ${
                  dead ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-ink/90">{i.note || "Untitled invitation"}</span>
                  <span className="text-xs text-muted">
                    {i.used}/{i.uses} used ·{" "}
                    {i.revokedAt
                      ? "revoked"
                      : i.expiresAt < Date.now()
                        ? "expired"
                        : `expires ${agoLabel(2 * Date.now() - i.expiresAt)}`.replace("ago", "from now")}
                  </span>
                </div>
                {i.accepted.length > 0 && (
                  <p className="mt-1 text-xs text-muted/80">{i.accepted.join(", ")}</p>
                )}
                {!dead && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <code className="min-w-0 flex-1 truncate rounded bg-surface/70 px-2 py-1 font-mono text-[0.7rem] text-muted">
                      {linkFor(i.id)}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(i.id)}
                      className="text-xs text-lavender underline-offset-2 hover:underline"
                    >
                      {copied === i.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(`id=${i.id}`)}
                      className="text-xs text-terracotta underline-offset-2 hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-medium text-ink">Who&rsquo;s in</h3>
      {allowed.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Nobody yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {allowed.map((e) => (
            <li key={e} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted">{e}</span>
              <button
                type="button"
                onClick={() => void remove(`email=${encodeURIComponent(e)}`)}
                className="shrink-0 text-xs text-terracotta underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted/80">
        Removing someone shuts the door on their next visit; the journal on their device
        stays theirs. Addresses set in <code className="text-[0.7rem]">ALLOWED_USERS</code>{" "}
        can only be removed there.
      </p>
    </div>
  );
}
