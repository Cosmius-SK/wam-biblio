"use client";

import { useCallback, useEffect, useState } from "react";
import { isGoogleConnected, keyState, protectWithPasscode, unlockHere } from "@/lib/googleAccount";
import { isUnlockedHere } from "@/lib/keyvault";
import type { KeyState } from "@/lib/keyvault";

/**
 * Settings › Security: the passcode that seals the journal itself.
 *
 * Not a login. Signing in with Google says *which* journal is yours; this is
 * what makes it unreadable to anyone who gets into that Google account — the
 * key in Drive is sealed with it, so both are needed.
 *
 * Which also means nobody can undo a forgotten passcode. The recovery phrase
 * is the only other way in, and the screen says so before it is set, not after
 * it is lost.
 */
type Stage = "idle" | "setting" | "phrase" | "unlocking";

export default function JournalKeyCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [state, setState] = useState<KeyState | "unknown">("unknown");
  const [here, setHere] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phrase, setPhrase] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async (interactive = false) => {
    const on = await isGoogleConnected();
    setConnected(on);
    if (!on) return;
    setHere(await isUnlockedHere());
    setState(await keyState(interactive));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function protect() {
    setError(null);
    if (pass.length < 4) return setError("Use at least four characters.");
    if (pass !== confirm) return setError("Those two don't match.");
    setBusy(true);
    try {
      setPhrase(await protectWithPasscode(pass));
      setStage("phrase");
      setPass("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setError(null);
    setBusy(true);
    try {
      const ok = await unlockHere(pass);
      if (!ok) {
        setError("That isn't it. Try again, or use your recovery phrase.");
        return;
      }
      setPass("");
      setStage("idle");
      setNote("That works. Your journal will fill in on the next sync.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (connected === false) {
    return (
      <Card>
        <p className="mt-2 text-sm text-muted">
          Sign in with Google first — the passcode seals the key kept with your account.
        </p>
      </Card>
    );
  }

  const sealed = state === "protected" || state === "protected-migrating";
  // Only offer to seal when we have actually established that it isn't.
  const unsealed = state === "plain";

  return (
    <Card>
      {stage === "phrase" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Write these six words down and keep them somewhere safe. They are the only way
            back in if you forget your passcode — <strong>nobody can recover them for you,
            not even the person who built this.</strong>
          </p>
          <p className="mt-4 select-all rounded-xl border border-hairline bg-paper/60 p-4 text-center font-serif text-lg tracking-wide text-ink">
            {phrase}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(phrase)}
              className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
            >
              Copy
            </button>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="h-4 w-4 accent-lavender"
            />
            I&rsquo;ve saved these words somewhere safe.
          </label>
          <button
            type="button"
            disabled={!saved}
            onClick={() => {
              setPhrase("");
              setSaved(false);
              setStage("idle");
              setNote("Your journal is sealed. It now takes your Google account and your passcode.");
              void refresh();
            }}
            className="mt-4 w-full rounded-full bg-ink/90 px-6 py-3 font-medium text-paper shadow-soft transition-transform enabled:active:scale-95 disabled:opacity-40"
          >
            Done
          </button>
        </>
      ) : stage === "setting" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Choose a passcode. You&rsquo;ll be asked for it when you open your journal on a new
            device.
          </p>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="passcode"
            className="mt-4 w-full rounded-xl border border-hairline bg-paper/50 px-4 py-3 text-ink placeholder:text-muted/60 focus:border-lavender/60 focus:outline-none"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="again"
            className="mt-2 w-full rounded-xl border border-hairline bg-paper/50 px-4 py-3 text-ink placeholder:text-muted/60 focus:border-lavender/60 focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStage("idle");
                setError(null);
              }}
              className="flex-1 rounded-full border border-hairline bg-paper/50 px-4 py-3 text-sm text-muted"
            >
              Not now
            </button>
            <button
              type="button"
              disabled={busy || !pass}
              onClick={() => void protect()}
              className="flex-1 rounded-full bg-ink/90 px-4 py-3 text-sm font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Sealing…" : "Set it"}
            </button>
          </div>
        </>
      ) : stage === "unlocking" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Enter your passcode — or your six-word recovery phrase, if that&rsquo;s what you
            have.
          </p>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="passcode or recovery phrase"
            className="mt-4 w-full rounded-xl border border-hairline bg-paper/50 px-4 py-3 text-ink placeholder:text-muted/60 focus:border-lavender/60 focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStage("idle");
                setError(null);
              }}
              className="flex-1 rounded-full border border-hairline bg-paper/50 px-4 py-3 text-sm text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !pass}
              onClick={() => void unlock()}
              className="flex-1 rounded-full bg-ink/90 px-4 py-3 text-sm font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Opening…" : "Open"}
            </button>
          </div>
        </>
      ) : state === "unknown" ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            biblio can&rsquo;t reach your Google account from this browser at the moment, so
            it can&rsquo;t tell whether your journal is sealed — and it won&rsquo;t guess.
          </p>
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setBusy(true);
              void refresh(true).finally(() => setBusy(false));
            }}
            disabled={busy}
            className="mt-4 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check now"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {sealed
              ? here
                ? "Your journal is sealed with your passcode. Opening it anywhere new takes your Google account and that passcode together."
                : "This journal is sealed. Enter your passcode to open it on this device."
              : "Right now, anyone who got into your Google account could read your journal. A passcode seals the key so it takes both."}
          </p>

          {note && <p className="mt-3 text-sm text-sage">{note}</p>}
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setNote(null);
              setStage(sealed && !here ? "unlocking" : "setting");
            }}
            disabled={!sealed && !unsealed}
            className="mt-4 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform active:scale-95"
          >
            {sealed ? (here ? "Change passcode" : "Enter passcode") : "Protect my journal"}
          </button>

          {state === "protected-migrating" && here && (
            <>
              <p className="mt-4 text-xs leading-relaxed text-muted/80">
                A copy of the old unsealed key is still kept as a safety net, because a
                passcode that turned out not to work would cost you the journal. It
                disappears by itself once the passcode has been shown to work on a{" "}
                <em>second</em> device — open biblio there, sign in, and use the button
                below.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNote(null);
                  setStage("unlocking");
                }}
                className="mt-3 text-xs text-lavender underline-offset-2 hover:underline"
              >
                Check my passcode works on this device
              </button>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Journal passcode</h2>
      {children}
    </div>
  );
}
