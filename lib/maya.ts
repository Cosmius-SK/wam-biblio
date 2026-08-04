"use client";

import { ambient } from "./ambient";

/**
 * Maya — the journal's quiet companion.
 *
 * She has no face: the breathing orb is her, and the drifting background is
 * her mood. She speaks aloud through the device's own speech synthesis (free,
 * on-device, offline) and her words also appear as text, so nothing is lost
 * when the sound is off. The ambient pad ducks while she talks, using the same
 * machinery the microphone uses.
 *
 * A singleton, like `ambient`, so any part of the app can hand her a line.
 */
export type MayaMoment =
  | "greeting"
  | "observation"
  | "saved"
  | "milestone"
  | "shaping"
  | "empty";

export interface MayaLine {
  id: number;
  text: string;
  moment: MayaMoment;
}

export type MayaFrequency = "quiet" | "often" | "silent";

type Listener = (line: MayaLine | null) => void;
type SpeakingListener = (speaking: boolean) => void;

const VOICE_KEY = "biblio_maya_voice"; // "" = off, "auto" = best guess, else voiceURI
const FREQ_KEY = "biblio_maya_freq";
const GREET_KEY = "biblio_maya_greeted"; // the day she last said hello

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — the choice just won't persist */
  }
}

/** Voices worth being Maya: calm, English, and preferably not robotic. */
function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  const liked = ["samantha", "serena", "moira", "karen", "google uk english female", "zira"];
  for (const name of liked) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pool.find((v) => v.localService) ?? pool[0];
}

class Maya {
  private listeners = new Set<Listener>();
  private speakingListeners = new Set<SpeakingListener>();
  private current: MayaLine | null = null;
  private nextId = 1;
  private hideTimer: number | null = null;

  // ---- what she's saying right now -------------------------------------

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.current);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onSpeaking(fn: SpeakingListener): () => void {
    this.speakingListeners.add(fn);
    return () => {
      this.speakingListeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current));
  }

  private emitSpeaking(v: boolean) {
    this.speakingListeners.forEach((l) => l(v));
  }

  /**
   * Say something. Shows the line, and speaks it when her voice is on.
   * `hold` is how long the words linger, in ms.
   */
  say(text: string, moment: MayaMoment = "observation", hold = 7000): void {
    if (this.frequency() === "silent" && moment !== "empty") return;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.current = { id: this.nextId++, text, moment };
    this.emit();
    this.speak(text);
    if (hold > 0) {
      this.hideTimer = window.setTimeout(() => this.dismiss(), hold);
    }
  }

  dismiss(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.current = null;
    this.emit();
  }

  // ---- her voice --------------------------------------------------------

  /** Whether speech is available in this browser at all. */
  canSpeak(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  voices(): SpeechSynthesisVoice[] {
    if (!this.canSpeak()) return [];
    return window.speechSynthesis.getVoices();
  }

  /** "" when her voice is off, otherwise "auto" or a specific voiceURI. */
  voiceSetting(): string {
    return read(VOICE_KEY, "auto");
  }

  setVoice(value: string): void {
    write(VOICE_KEY, value);
    if (value === "") this.stopSpeaking();
  }

  frequency(): MayaFrequency {
    const v = read(FREQ_KEY, "quiet");
    return v === "often" || v === "silent" ? v : "quiet";
  }

  setFrequency(v: MayaFrequency): void {
    write(FREQ_KEY, v);
  }

  private speak(text: string): void {
    const setting = this.voiceSetting();
    if (setting === "" || !this.canSpeak()) return;
    const synth = window.speechSynthesis;
    try {
      synth.cancel(); // never let her talk over herself
      const utterance = new SpeechSynthesisUtterance(text);
      const all = synth.getVoices();
      const chosen =
        setting === "auto"
          ? preferredVoice(all)
          : all.find((v) => v.voiceURI === setting) ?? preferredVoice(all);
      if (chosen) utterance.voice = chosen;
      utterance.rate = 0.94; // unhurried
      utterance.pitch = 1.02;
      utterance.onstart = () => {
        ambient.duck();
        this.emitSpeaking(true);
      };
      const done = () => {
        ambient.unduck();
        this.emitSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    } catch {
      /* speech unavailable or blocked — the words are on screen anyway */
    }
  }

  stopSpeaking(): void {
    if (!this.canSpeak()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    ambient.unduck();
    this.emitSpeaking(false);
  }

  /** True the first time she's asked on a given calendar day. */
  shouldGreetToday(): boolean {
    const today = new Date().toDateString();
    if (read(GREET_KEY, "") === today) return false;
    write(GREET_KEY, today);
    return true;
  }
}

export const maya = new Maya();
