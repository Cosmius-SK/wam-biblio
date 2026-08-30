"use client";

/**
 * Voice → text for capture.
 *
 * Phase 1 uses the browser's built-in Web Speech API: zero install, live
 * partial transcripts, and the audio is handled by the platform rather than
 * our servers. It is exposed behind this small interface so a fully on-device
 * engine (Whisper WASM) can be swapped in later for maximum privacy without
 * touching the capture UI.
 *
 * Two things about the API itself, both learned from a transcript that read
 * "…within 2 days I have toI need to learn…I need to learn…I need to learn…":
 *
 * **Never accumulate.** The obvious loop — walk from `event.resultIndex` and
 * append anything final to a running string — is what every example shows and
 * it is wrong on Android, where the same result is delivered final more than
 * once and `resultIndex` does not reliably advance. Each redelivery appended
 * the whole sentence again, one word longer every time. Rebuilding the text
 * from `event.results` on every event is idempotent, so redelivery costs
 * nothing.
 *
 * **The session ends on its own.** Android stops listening at a pause even
 * with `continuous`, so a long thought was silently cut off at the first
 * breath. We restart until the speaker says stop, keeping what has been said
 * so far in `committed` — a new session hands back a fresh `results` list.
 */

// Minimal typings for the (still non-standard) Web Speech API.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Errors there is no point restarting after — they will only repeat. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "bad-grammar"]);
/** A session that ends this fast, saying nothing, has failed rather than paused. */
const STILLBORN_MS = 400;
const MAX_STILLBORN = 4;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isTranscriptionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface DictationHandle {
  stop: () => void;
}

export interface DictationCallbacks {
  /** Fires with the full text so far (final + current interim). */
  onUpdate: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

/**
 * Join two fragments with exactly one space.
 *
 * The engine hands back chunks with no leading space, so concatenating them
 * produced "I have to" + "I need" = "toI need" — which is half of what made
 * the runaway transcript unreadable even before the repetition.
 */
function join(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/**
 * Start live dictation. Returns a handle to stop it, or null if unsupported.
 */
/**
 * Which English to listen for.
 *
 * "en-US" was hardcoded, and the engine's accuracy on an Indian or British
 * accent is noticeably worse when it is expecting an American one. The phone's
 * own language is the best guess available — but only when it is already some
 * kind of English: somebody whose phone is in Tamil may well still be dictating
 * in English, and guessing wrong there is worse than not guessing.
 */
export function dictationLang(): string {
  try {
    const tag = navigator.language || "";
    return /^en\b/i.test(tag) ? tag : "en-US";
  } catch {
    return "en-US";
  }
}

export function startDictation(
  { onUpdate, onError, onEnd }: DictationCallbacks,
  lang = dictationLang(),
): DictationHandle | null {
  const found = getRecognitionCtor();
  if (!found) return null;
  // Bound to a local so the narrowing survives into `listen`, which TypeScript
  // otherwise re-widens because it is called from a callback.
  const Recognition: SpeechRecognitionCtor = found;

  /** Everything said in sessions that have already ended. */
  let committed = "";
  let stopped = false;
  let stillborn = 0;
  let current: SpeechRecognitionLike | null = null;

  function listen(): SpeechRecognitionLike {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    /** This session's finished text — recomputed, never appended to. */
    let settled = "";
    const startedAt = Date.now();

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result?.[0]?.transcript ?? "";
        if (result.isFinal) final = join(final, chunk);
        else interim = join(interim, chunk);
      }
      settled = final;
      onUpdate(join(join(committed, final), interim));
    };

    recognition.onerror = (e) => {
      if (FATAL.has(e.error)) {
        stopped = true;
        onError?.(e.error);
      }
      // Everything else — "no-speech", "network", "aborted" — is a pause or a
      // hiccup, and `onend` will pick it back up. Reporting those as errors
      // stopped a perfectly good dictation for standing still a moment.
    };

    recognition.onend = () => {
      committed = join(committed, settled);
      const empty = !settled && Date.now() - startedAt < STILLBORN_MS;
      stillborn = empty ? stillborn + 1 : 0;
      if (stopped || stillborn >= MAX_STILLBORN) {
        onEnd?.();
        return;
      }
      try {
        current = listen();
      } catch {
        onEnd?.();
      }
    };

    recognition.start();
    return recognition;
  }

  try {
    current = listen();
  } catch {
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      // stop(), not abort(): the last words spoken are still in flight and
      // stopping politely lets them land.
      try {
        current?.stop();
      } catch {
        /* already gone */
      }
    },
  };
}
