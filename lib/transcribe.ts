"use client";

/**
 * Voice → text for capture.
 *
 * Phase 1 uses the browser's built-in Web Speech API: zero install, live
 * partial transcripts, and the audio is handled by the platform rather than
 * our servers. It is exposed behind this small interface so a fully on-device
 * engine (Whisper WASM) can be swapped in later for maximum privacy without
 * touching the capture UI.
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
 * Start live dictation. Returns a handle to stop it, or null if unsupported.
 */
export function startDictation(
  { onUpdate, onError, onEnd }: DictationCallbacks,
  lang = "en-US",
): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const chunk = result[0].transcript;
      if (result.isFinal) finalText += chunk;
      else interim += chunk;
    }
    onUpdate((finalText + interim).replace(/\s+/g, " ").trimStart());
  };

  recognition.onerror = (e) => onError?.(e.error);
  recognition.onend = () => onEnd?.();

  recognition.start();
  return { stop: () => recognition.stop() };
}
