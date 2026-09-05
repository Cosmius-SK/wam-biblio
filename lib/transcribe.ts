"use client";

import { composeSpeech, finishSpeech, type Utterance } from "./speechText";

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
 * so far — a new session hands back a fresh `results` list.
 *
 * What this file hands upward is not a string but a list of *utterances* with
 * the silence before each one, because that silence is where the punctuation
 * is hiding. See lib/speechText.ts.
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

/**
 * The one dictation that may be running.
 *
 * A browser gives the page a single microphone, and a recogniser that is still
 * alive holds it whether or not anything is listening to it. Two of them and
 * the second hears nothing while the tab keeps showing a live mic — which is
 * exactly what a stuck one looks like from the outside. Starting always
 * releases whatever came before, even if it should already be gone.
 */
interface LiveDictation {
  handle: DictationHandle;
  release: () => void;
}
let active: LiveDictation | null = null;

/** Errors there is no point restarting after — they will only repeat. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "bad-grammar"]);
/** A session that ends this fast, saying nothing, has failed rather than paused. */
const STILLBORN_MS = 400;
const MAX_STILLBORN = 4;
/**
 * Silence after which the mic turns itself off.
 *
 * Restarting at every pause is what stops a thought being cut off mid-breath,
 * but taken literally it means a mic that never stops — running in a pocket,
 * on a battery, listening to a room. Long enough that no pause in speech comes
 * near it; short enough that a forgotten mic is a minute, not an afternoon.
 */
const SILENCE_LIMIT_MS = 30_000;

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
  /**
   * Forget everything said so far and carry on listening.
   *
   * The transcript is cumulative for as long as the mic is on, and the field
   * is rewritten from it on every update. So somebody who cleared the box and
   * spoke again got the cleared text back, with the new words on the end of
   * it — the box was theirs to edit and this owned it. Editing while listening
   * calls this, and what they typed becomes the new starting point.
   */
  reset: () => void;
}

export interface DictationCallbacks {
  /** Fires with the full text so far (final + current interim). */
  onUpdate: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
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
  let committed: Utterance[] = [];
  /** When the last thing anyone said was finished — the start of the silence. */
  let lastEnd = Date.now();
  /** Results before this index have been disowned by a reset. */
  let skipBefore = 0;
  /** How many results the engine has handed over in this session so far. */
  let seenCount = 0;
  let stopped = false;
  let stillborn = 0;
  /**
   * Chrome's dictation is not on the device: it streams the audio to Google
   * and reads the answer back. On a corporate network that call can be blocked
   * while the microphone itself is perfectly available — so the tab shows a
   * live mic, nothing is ever transcribed, and restarting after each failure
   * (which is right for an ordinary hiccup) holds the microphone open forever
   * and says nothing about why. Twice in a row with nothing heard is not a
   * hiccup.
   */
  let networkErrors = 0;
  let current: SpeechRecognitionLike | null = null;

  function listen(): SpeechRecognitionLike {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    /** This session's finished utterances — recomputed, never appended to. */
    let settled: Utterance[] = [];
    /** When each result first appeared, and when it stopped changing. */
    const appeared = new Map<number, number>();
    const finalised = new Map<number, number>();
    const startedAt = Date.now();

    recognition.onresult = (event) => {
      const now = Date.now();
      seenCount = event.results.length;
      const done: Utterance[] = [];
      let interim = "";
      for (let i = skipBefore; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = (result?.[0]?.transcript ?? "").trim();
        if (!appeared.has(i)) appeared.set(i, now);
        if (result.isFinal) {
          if (!finalised.has(i)) finalised.set(i, now);
          if (!chunk) continue;
          // The pause is the silence between the last thing finishing and this
          // one starting — not the distance between two finals, which would
          // include however long this took to say.
          const previousEnd = finalised.get(i - 1) ?? lastEnd;
          done.push({ text: chunk, gapMs: Math.max(0, (appeared.get(i) ?? now) - previousEnd) });
        } else if (chunk) {
          interim = interim ? `${interim} ${chunk}` : chunk;
        }
      }
      settled = done;
      networkErrors = 0; // something came back, so the service is reachable
      onUpdate(composeSpeech([...committed, ...done], interim));
    };

    recognition.onerror = (e) => {
      if (FATAL.has(e.error)) {
        stopped = true;
        onError?.(e.error);
        return;
      }
      if (e.error === "network") {
        networkErrors++;
        if (networkErrors >= 2) {
          stopped = true;
          onError?.("network");
        }
        return;
      }
      // Everything else — "no-speech", "network", "aborted" — is a pause or a
      // hiccup, and `onend` will pick it back up. Reporting those as errors
      // stopped a perfectly good dictation for standing still a moment.
    };

    recognition.onend = () => {
      committed = [...committed, ...settled];
      skipBefore = 0; // a new session starts its own results at zero
      seenCount = 0;
      const last = [...finalised.values()].pop();
      if (last) lastEnd = last;
      const empty = settled.length === 0 && Date.now() - startedAt < STILLBORN_MS;
      stillborn = empty ? stillborn + 1 : 0;
      const quietFor = Date.now() - lastEnd;
      if (stopped || stillborn >= MAX_STILLBORN || quietFor > SILENCE_LIMIT_MS) {
        stopped = true;
        if (active?.handle === handle) active = null;
        // They have finished talking, so the last sentence can be closed.
        const text = finishSpeech(composeSpeech(committed));
        if (text) onUpdate(text);
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

  /** Let go of the microphone now, whatever state the engine thinks it is in. */
  const release = () => {
    stopped = true;
    try {
      current?.abort();
    } catch {
      /* already gone */
    }
    current = null;
  };

  // Whatever was holding the microphone before this, let it go.
  active?.release();

  try {
    current = listen();
  } catch {
    return null;
  }

  const handle: DictationHandle = {
    reset: () => {
      // Disown what has been said WITHOUT restarting the session. Restarting
      // was tempting — it is what happens at every pause — but this is called
      // on every keystroke while the mic is on, and a restart per keystroke is
      // a queue of half-born recognisers fighting over one microphone.
      committed = [];
      skipBefore = seenCount;
      lastEnd = Date.now();
    },
    stop: () => {
      stopped = true;
      if (active?.handle === handle) active = null;
      // stop(), not abort(): the last words spoken are still in flight and
      // stopping politely lets them land. But a session that does not end
      // keeps the microphone, and a held microphone that nothing is listening
      // to is worse than a lost word — so there is a deadline.
      try {
        current?.stop();
      } catch {
        release();
        return;
      }
      window.setTimeout(() => {
        if (current) release();
      }, 1500);
    },
  };
  active = { handle, release };
  return handle;
}
