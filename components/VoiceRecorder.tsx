"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  isTranscriptionSupported,
  startDictation,
  type DictationHandle,
} from "@/lib/transcribe";
import { ambient } from "@/lib/ambient";

/**
 * A calm mic button. While listening it emits the cumulative spoken transcript
 * via `onTranscript`; the composer decides how to merge it with typed text.
 */
export default function VoiceRecorder({
  onStart,
  onTranscript,
  onError,
  controlRef,
}: {
  onStart: () => void;
  onTranscript: (spoken: string) => void;
  onError?: (message: string) => void;
  /** Set while listening, so the composer can tell dictation to start over. */
  controlRef?: React.MutableRefObject<{ reset: () => void } | null>;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const handleRef = useRef<DictationHandle | null>(null);

  useEffect(() => {
    setSupported(isTranscriptionSupported());
    return () => {
      handleRef.current?.stop();
      if (controlRef) controlRef.current = null;
      ambient.unduck();
    };
    // controlRef is a ref the parent owns; it never changes identity and
    // depending on it would only re-run the unmount cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    if (controlRef) controlRef.current = null;
    setListening(false);
    ambient.unduck();
  };

  const start = () => {
    // Soften the ambient pad so it never bleeds into the recording.
    ambient.duck();
    onStart();
    const handle = startDictation({
      onUpdate: onTranscript,
      onError: (msg) => {
        onError?.(msg);
        stop();
      },
      onEnd: () => {
        // Includes the mic turning itself off after a long silence, so the
        // button has to come back up on its own.
        handleRef.current = null;
        if (controlRef) controlRef.current = null;
        setListening(false);
        ambient.unduck();
      },
    });
    if (!handle) {
      setSupported(false);
      ambient.unduck();
      return;
    }
    handleRef.current = handle;
    if (controlRef) controlRef.current = { reset: () => handle.reset() };
    setListening(true);
  };

  if (!supported) {
    return (
      <p className="text-xs text-muted">
        Voice capture isn&rsquo;t available in this browser — typing works just as well.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? "Stop recording" : "Start voice capture"}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-soft transition-colors ${
          listening ? "bg-terracotta text-paper" : "bg-surface text-ink hover:bg-surface/80"
        }`}
      >
        {listening && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-terracotta/40"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <MicIcon active={listening} />
      </button>
      <span className="text-sm text-muted">
        {listening ? (
          <>
            Listening… speak freely
            {/* Worth saying once, where it is useful: nobody guesses that a
                dictation engine takes punctuation as words. */}
            <span className="mt-0.5 block text-xs text-muted/70">
              Say &ldquo;full stop&rdquo;, &ldquo;comma&rdquo; or &ldquo;new paragraph&rdquo; to
              punctuate as you go.
            </span>
          </>
        ) : (
          "Tap to speak"
        )}
      </span>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill={active ? "currentColor" : "none"} />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </svg>
  );
}
