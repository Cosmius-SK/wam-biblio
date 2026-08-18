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
  | "empty"
  | "presence"
  | "nudge";

export interface MayaLine {
  id: number;
  text: string;
  moment: MayaMoment;
  /** Ways to answer her, when the line is a question. */
  answers?: string[];
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

/**
 * Maya is a she, so only women's voices are offered.
 *
 * The Web Speech API exposes no gender, so this reads the voice's name:
 * Android and Windows often say so outright ("…#female_1", "Google UK English
 * Female"), and elsewhere the name is a given name. Anything recognisably a
 * man's voice is ruled out, and novelty voices with it.
 */
const FEMALE_NAMES = [
  "samantha", "serena", "moira", "karen", "tessa", "fiona", "victoria", "allison",
  "ava", "susan", "zoe", "nicky", "kate", "martha", "catherine", "amelie", "anna",
  "alice", "ellen", "joana", "luciana", "milena", "paulina", "sara", "satu", "yuna",
  "zosia", "zuzana", "kanya", "mariska", "nora", "lekha", "veena", "zira", "hazel",
  "eva", "linda", "heera", "aria", "jenny", "michelle", "sonia", "libby", "natasha",
  "clara", "emily", "isabella", "elsa", "carmit", "damayanti", "ioana", "laura",
  "lesya", "marie", "mei", "melina", "monica", "nicolas", "rishi", "sin-ji", "ting",
];
const MALE_NAMES = [
  "daniel", "alex", "fred", "tom", "aaron", "arthur", "gordon", "oliver", "reed",
  "rocko", "ralph", "jamie", "nathan", "david", "mark", "guy", "ravi", "george",
  "james", "thomas", "william", "liam", "brian", "christopher", "eric", "roger",
  "steffan", "prabhat", "hemant", "junior", "grandpa", "bruce", "albert", "yuri",
  "maged", "jorge", "diego", "juan", "xander", "luca", "gustav", "felipe",
];
const NOVELTY =
  /(bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|hysterical|pipe organ)/;

export function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  if (NOVELTY.test(n)) return false;
  if (n.includes("female")) return true; // "…#female_1", "UK English Female"
  if (/\bmale\b|#male|_male/.test(n)) return false; // \b never matches inside "female"
  if (MALE_NAMES.some((m) => n.includes(m))) return false;
  return FEMALE_NAMES.some((f) => n.includes(f));
}

/** Her voice: a woman's, English where possible, and preferably on-device. */
function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const women = voices.filter(isFemaleVoice);
  const pool = women.length > 0 ? women : voices;
  const english = pool.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const shortlist = english.length > 0 ? english : pool;
  for (const name of ["samantha", "serena", "karen", "moira", "female", "zira"]) {
    const hit = shortlist.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return shortlist.find((v) => v.localService) ?? shortlist[0];
}

class Maya {
  private listeners = new Set<Listener>();
  private speakingListeners = new Set<SpeakingListener>();
  private current: MayaLine | null = null;
  private nextId = 1;
  private hideTimer: number | null = null;
  private answered: ((answer?: string) => void) | null = null;
  private unanswered: (() => void) | null = null;

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

  /**
   * Ask something that wants an answer — the presence check.
   *
   * Silence is a real answer here, so `onSilence` fires if the words time out
   * untouched. Anything else the person does counts as being present, which is
   * why callers also resolve this from ordinary interaction rather than
   * insisting on a tap.
   */
  ask(
    text: string,
    answers: string[],
    onAnswer: (answer?: string) => void,
    onSilence: () => void,
    hold = 45000,
  ): void {
    if (this.frequency() === "silent") return;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.answered = onAnswer;
    this.unanswered = onSilence;
    this.current = { id: this.nextId++, text, moment: "presence", answers };
    this.emit();
    this.speak(text);
    this.hideTimer = window.setTimeout(() => {
      const silent = this.unanswered;
      this.answered = null;
      this.unanswered = null;
      this.dismiss();
      silent?.();
    }, hold);
  }

  /**
   * They're there. Resolves a pending ask, however they showed it — a tapped
   * mark, or simply moving. `answer` is which mark, when there was one.
   */
  answer(answer?: string): void {
    const cb = this.answered;
    this.answered = null;
    this.unanswered = null;
    if (!cb) return;
    this.dismiss();
    cb(answer);
  }

  /** Whether a question is currently waiting on an answer. */
  awaitingAnswer(): boolean {
    return this.answered !== null;
  }

  /**
   * Read something aloud without taking the footer.
   *
   * For places that show her words themselves — the walkthrough — so she
   * doesn't say the same thing twice in two places.
   */
  speakAside(text: string): void {
    if (this.frequency() === "silent") return;
    this.speak(text);
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

  /** Only the voices she'd use — falling back to all if none look female. */
  femaleVoices(): SpeechSynthesisVoice[] {
    const all = this.voices();
    const women = all.filter(isFemaleVoice);
    return women.length > 0 ? women : all;
  }

  /**
   * iOS will only start speaking from inside a real user gesture, and pauses
   * synthesis whenever the page goes to the background. Calling this from a
   * tap wakes it up so later lines are audible.
   */
  prime(): void {
    if (!this.canSpeak()) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
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

  private speak(text: string, retried = false): void {
    const setting = this.voiceSetting();
    if (setting === "" || !this.canSpeak()) return;
    const synth = window.speechSynthesis;

    // Voices load asynchronously — on iOS the first call often sees none at
    // all. Wait for them once rather than speaking in the wrong voice.
    if (synth.getVoices().length === 0 && !retried) {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        this.speak(text, true);
      };
      synth.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", onVoices);
      }, 3000);
      return;
    }

    try {
      synth.cancel(); // never let her talk over herself
      synth.resume(); // iOS suspends synthesis in the background
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
