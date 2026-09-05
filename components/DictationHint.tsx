"use client";

import { useEffect, useState } from "react";

/**
 * Where the good dictation actually is.
 *
 * biblio had its own microphone button, built on the browser's speech API, and
 * it was removed rather than improved. A browser hands a website a small,
 * low-latency engine that commits each word as it is spoken, with almost no
 * lookahead: no punctuation, names it has never heard turned into the nearest
 * word it has, and "going to help" settled as "going to hell" before the rest
 * of the sentence could argue. Every device already has a far better one, one
 * key away, that hears a whole sentence before deciding any word in it.
 *
 * Keeping both would have been the polite thing and the wrong one. An inferior
 * path that is more visible is the path people take, and then judge the
 * product by. So: one line, saying exactly which key.
 */
type Where = "touch" | "mac" | "windows" | "other";

function device(): Where {
  if (typeof navigator === "undefined") return "other";
  if (navigator.maxTouchPoints > 0) return "touch";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  return "other";
}

const SAYS: Record<Where, React.ReactNode> = {
  touch: (
    <>
      Rather speak? Tap the <strong className="font-medium text-ink/80">microphone on your
      keyboard</strong> and talk into the box.
    </>
  ),
  mac: (
    <>
      Rather speak? Press the <strong className="font-medium text-ink/80">microphone key</strong>{" "}
      (or <strong className="font-medium text-ink/80">fn</strong> twice) and talk into the box.
    </>
  ),
  windows: (
    <>
      Rather speak? Press{" "}
      <strong className="font-medium text-ink/80">Windows + H</strong> and talk into the box.
    </>
  ),
  other: <>Rather speak? Your keyboard&rsquo;s dictation types straight into the box.</>,
};

export default function DictationHint() {
  const [where, setWhere] = useState<Where | null>(null);
  useEffect(() => setWhere(device()), []);
  if (!where) return null;

  return (
    <p className="flex items-start gap-2 text-sm text-muted">
      <MicIcon />
      <span>
        {SAYS[where]}{" "}
        <span className="text-muted/70">
          Your device&rsquo;s own dictation is better than anything a website can offer — it
          punctuates as it goes, and biblio tidies up the rest.
        </span>
      </span>
    </p>
  );
}

function MicIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="mt-0.5 flex-none text-muted/70"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
