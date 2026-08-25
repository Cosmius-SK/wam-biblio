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
  | "nudge"
  | "invite";

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
/** One beat, fired per spoken word — what makes the orb move in time. */
type PulseListener = () => void;

/** Where she is in a passage being read aloud. */
export interface ReadingState {
  /** The line she is on, or null when she is not part-way through one. */
  index: number | null;
  /** True while the sound is actually running. */
  active: boolean;
}
type ReadingListener = (state: ReadingState) => void;

const VOICE_KEY = "biblio_maya_voice"; // "" = off, "auto" = best guess, else voiceURI
const FREQ_KEY = "biblio_maya_freq";
const GREET_KEY = "biblio_maya_greeted"; // the day she last said hello
const RATE_KEY = "biblio_maya_rate";

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
 * Maya is a she, so her own voices come first.
 *
 * The Web Speech API exposes no gender, so this reads the voice's name:
 * Android and Windows often say so outright ("…#female_1", "Google UK English
 * Female"), and elsewhere the name is a given name.
 *
 * A name on neither list is *unknown*, not "fine" — an earlier version had one
 * pool and one fallback, so "no woman I recognise here" quietly meant "any
 * voice will do", and an iPhone answered in a man's. Two of the names below
 * were also on the wrong list; Rishi and Nicolas are men.
 */
const FEMALE_NAMES = [
  "samantha", "serena", "moira", "karen", "tessa", "fiona", "victoria", "allison",
  "ava", "susan", "zoe", "nicky", "kate", "martha", "catherine", "amelie", "anna",
  "alice", "ellen", "joana", "luciana", "milena", "paulina", "sara", "satu", "yuna",
  "zosia", "zuzana", "kanya", "mariska", "nora", "lekha", "veena", "zira", "hazel",
  "eva", "linda", "heera", "aria", "jenny", "michelle", "sonia", "libby", "natasha",
  "clara", "emily", "isabella", "elsa", "carmit", "damayanti", "ioana", "laura",
  "lesya", "marie", "mei", "melina", "monica", "sin-ji", "ting", "matilda",
  "shelley", "sandy", "kyoko", "lana", "lilia", "marta", "meijia", "montse",
  "amira", "sofia", "yelda", "sangeeta", "geeta",
];
const MALE_NAMES = [
  "daniel", "alex", "fred", "tom", "aaron", "arthur", "gordon", "oliver", "reed",
  "rocko", "ralph", "jamie", "nathan", "david", "mark", "guy", "ravi", "george",
  "james", "thomas", "william", "liam", "brian", "christopher", "eric", "roger",
  "steffan", "prabhat", "hemant", "junior", "grandpa", "bruce", "albert", "yuri",
  "maged", "jorge", "diego", "juan", "xander", "luca", "gustav", "felipe",
  "rishi", "nicolas", "eddy", "rocky",
];
const NOVELTY =
  /(bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|hysterical|pipe organ)/;

export type VoiceGender = "her" | "him" | "unknown";

/** Whose voice this sounds like, as far as the name gives it away. */
export function voiceGender(v: SpeechSynthesisVoice): VoiceGender {
  const n = v.name.toLowerCase();
  if (n.includes("female")) return "her"; // "…#female_1", "UK English Female"
  if (/\bmale\b|#male|_male/.test(n)) return "him"; // \b never matches inside "female"
  if (MALE_NAMES.some((m) => n.includes(m))) return "him";
  if (FEMALE_NAMES.some((f) => n.includes(f))) return "her";
  return "unknown";
}

export function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  return voiceGender(v) === "her";
}

/** The joke voices — offerable, never chosen for her. */
export function isNovelty(v: SpeechSynthesisVoice): boolean {
  return NOVELTY.test(v.name.toLowerCase());
}

function isEnglish(v: SpeechSynthesisVoice): boolean {
  return !!v.lang?.toLowerCase().startsWith("en");
}

/**
 * How human a voice is likely to sound.
 *
 * Every platform now ships two generations side by side: the old formant
 * voices — Zira, Samantha, David — and neural ones that are not really
 * comparable. They are distinguished only by a word in the name, so that is
 * what this reads.
 *
 * An earlier version preferred `localService`, which reliably picked the worse
 * one: the good voices are usually the network ones. That single line is why
 * she sounded like a station announcement.
 *
 * The voice the phone itself speaks in counts for something too — somebody who
 * has chosen a voice in Settings has told us which one they like.
 */
/**
 * Apple ships one voice at up to three qualities and says which only in the
 * identifier: `com.apple.voice.premium.en-US.Ava` sits beside
 * `com.apple.voice.compact.en-US.Ava`, and both are called "Ava". Reading the
 * name alone ranks the good one and the tinny one identically, and puts two
 * rows in the picker with nothing to tell them apart. So everything below
 * reads the name *and* the identifier.
 */
export type VoiceTier = "premium" | "enhanced" | "compact" | "";

/** Both halves of what a platform tells us about a voice, lowercased. */
function voiceText(v: SpeechSynthesisVoice): string {
  return `${v.name} ${v.voiceURI}`.toLowerCase();
}

export function voiceTier(v: SpeechSynthesisVoice): VoiceTier {
  const s = voiceText(v);
  if (s.includes("premium")) return "premium";
  if (s.includes("enhanced")) return "enhanced";
  if (s.includes("compact")) return "compact";
  return "";
}

/** The newer, neural generation — what earns a voice a star in the picker. */
export function isNaturalVoice(v: SpeechSynthesisVoice): boolean {
  return /(natural|neural|wavenet|journey|studio|premium|enhanced|siri)/.test(voiceText(v));
}

export function voiceQuality(v: SpeechSynthesisVoice): number {
  const n = voiceText(v);
  let score = 0;
  if (/(natural|neural|wavenet|journey|studio|premium|enhanced)/.test(n)) score += 100;
  if (/online/.test(n)) score += 40;
  if (/google/.test(n)) score += 25; // Google's web voices are decidedly better
  if (/siri/.test(n)) score += 30;
  if (v.default) score += 60; // the device's own choice, short of a better one
  if (/(compact|eloquence|espeak)/.test(n)) score -= 80; // the tinny ones
  if (v.localService) score -= 10; // a tiebreak, never a preference
  return score;
}

/**
 * Who she may speak as, in order of preference: women first, then voices
 * nobody has claimed either way, and a man only if this device has literally
 * nothing else. Novelty voices are never in the running.
 */
function speakingPool(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const usable = voices.filter((v) => !isNovelty(v));
  const hers = usable.filter((v) => voiceGender(v) === "her");
  if (hers.length > 0) return hers;
  const unclaimed = usable.filter((v) => voiceGender(v) === "unknown");
  if (unclaimed.length > 0) return unclaimed;
  return usable.length > 0 ? usable : voices;
}

/** Her voice: the most human woman's voice available, English where possible. */
function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const pool = speakingPool(voices);
  const english = pool.filter(isEnglish);
  const shortlist = english.length > 0 ? english : pool;
  return [...shortlist].sort((a, b) => voiceQuality(b) - voiceQuality(a))[0];
}

/** Stable enough to key a list by: platforms do repeat voiceURIs. */
export function voiceKey(v: SpeechSynthesisVoice): string {
  return `${v.voiceURI}|${v.name}|${v.lang}`;
}

export interface VoiceChoices {
  /** The ones she'd pick from herself. */
  hers: SpeechSynthesisVoice[];
  /** Everything else this device has, so nobody is stuck with our guess. */
  others: SpeechSynthesisVoice[];
}

/**
 * Every voice on the device, hers first and the rest still offered.
 *
 * The picker used to show only the names this file recognises as women, which
 * meant a voice somebody had downloaded on purpose could be missing from the
 * one list where they went looking for it. A guess is a good default and a bad
 * gate.
 */
export function voiceChoices(all: SpeechSynthesisVoice[]): VoiceChoices {
  // Some platforms list the same voice twice — once per installed variant —
  // and two identical rows in a picker is a shrug, not a choice.
  const seen = new Set<string>();
  const voices = all.filter((v) => {
    const k = voiceKey(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const order = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => {
    const ea = isEnglish(a) ? 0 : 1;
    const eb = isEnglish(b) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const q = voiceQuality(b) - voiceQuality(a);
    return q !== 0 ? q : a.name.localeCompare(b.name);
  };
  const hers = voices.filter((v) => voiceGender(v) === "her" && !isNovelty(v)).sort(order);
  const taken = new Set(hers);
  const others = voices.filter((v) => !taken.has(v)).sort(order);
  return { hers, others };
}

class Maya {
  private listeners = new Set<Listener>();
  private speakingListeners = new Set<SpeakingListener>();
  private pulseListeners = new Set<PulseListener>();
  private pulseTimer: number | null = null;
  private readingListeners = new Set<ReadingListener>();
  /** The lines of the passage she is reading, if any. */
  private passage: string[] | null = null;
  private reading: ReadingState = { index: null, active: false };
  /**
   * Something is already speaking as her — the walkthrough, for one.
   *
   * A greeting and a nudge arriving over the top of it is not two features
   * being helpful, it is one person interrupting herself, and it reads as
   * software. Whoever has her keeps her until they let go.
   */
  private claimed = false;
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

  /**
   * A beat per spoken word.
   *
   * Speech synthesis exposes no audio levels, but it does announce word
   * boundaries — which is enough for the orb to move *with* her rather than to
   * a loop that merely happens while she talks. The difference is what makes
   * someone look at it instead of past it.
   */
  onPulse(fn: PulseListener): () => void {
    this.pulseListeners.add(fn);
    return () => {
      this.pulseListeners.delete(fn);
    };
  }

  private emitPulse() {
    this.pulseListeners.forEach((l) => l());
  }

  /** Some platforms never fire word boundaries; keep a heartbeat for those. */
  private startFallbackPulse(text: string) {
    this.stopFallbackPulse();
    // Roughly a word every 380ms at her speaking rate.
    const words = Math.max(1, text.split(/\s+/).length);
    let left = words;
    this.pulseTimer = window.setInterval(() => {
      if (left-- <= 0) {
        this.stopFallbackPulse();
        return;
      }
      this.emitPulse();
    }, 380);
  }

  private stopFallbackPulse() {
    if (this.pulseTimer !== null) window.clearInterval(this.pulseTimer);
    this.pulseTimer = null;
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
  /** Take her over — the walkthrough speaks as her and must not be talked across. */
  claim(): void {
    this.claimed = true;
    this.dismiss();
  }

  release(): void {
    this.claimed = false;
  }

  say(text: string, moment: MayaMoment = "observation", hold = 7000): void {
    if (this.claimed) return;
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
    if (this.claimed || this.frequency() === "silent") return;
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
   * Offer something that opens elsewhere — her feedback question.
   *
   * Unlike `ask`, silence here is a complete answer and nothing happens on it:
   * she made an offer, it wasn't taken, and that is the end of it. Kept
   * distinct from the presence check so ordinary interaction can never
   * accidentally accept an invitation.
   */
  invite(text: string, label: string, onAccept: () => void, hold = 20000): void {
    if (this.claimed || this.frequency() === "silent") return;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.answered = () => onAccept();
    this.unanswered = null;
    this.current = { id: this.nextId++, text, moment: "invite", answers: [label] };
    this.emit();
    this.speak(text);
    this.hideTimer = window.setTimeout(() => {
      this.answered = null;
      this.dismiss();
    }, hold);
  }

  /** What she is in the middle of, if anything. */
  moment(): MayaMoment | null {
    return this.current?.moment ?? null;
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

  /** Every voice on this device, hers first — see `voiceChoices`. */
  voiceList(): VoiceChoices {
    return voiceChoices(this.voices());
  }

  /**
   * Ask the platform to publish its voice list.
   *
   * Some browsers — iOS above all — hand back a short list or none at all
   * until synthesis has actually been used once. A silent utterance is the
   * conventional knock on that door, and like all speech there it has to come
   * out of a tap.
   */
  nudgeVoices(): void {
    if (!this.canSpeak()) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) return; // never across something she's saying
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    } catch {
      /* nothing to lose */
    }
  }

  /** The voice she would use right now, for showing next to "Auto". */
  autoVoice(): SpeechSynthesisVoice | undefined {
    return preferredVoice(this.voices());
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

  /**
   * How fast she talks.
   *
   * A preference rather than a constant, because "too fast" and "too slow"
   * were both true and neither was a bug — they were two people's ears.
   */
  rate(): number {
    const n = Number(read(RATE_KEY, "0.92"));
    return Number.isFinite(n) && n >= 0.6 && n <= 1.3 ? n : 0.92;
  }

  setRate(n: number): void {
    write(RATE_KEY, String(n));
  }

  private speak(text: string, retried = false, onDone?: (ok: boolean) => void): void {
    const setting = this.voiceSetting();
    if (setting === "" || !this.canSpeak()) return;
    const synth = window.speechSynthesis;

    // Voices load asynchronously — on iOS the first call often sees none at
    // all. Wait for them once rather than speaking in the wrong voice.
    if (synth.getVoices().length === 0 && !retried) {
      let settled = false;
      const go = () => {
        if (settled) return;
        settled = true;
        synth.removeEventListener("voiceschanged", onVoices);
        this.speak(text, true, onDone);
      };
      const onVoices = () => go();
      synth.addEventListener("voiceschanged", onVoices);
      // If the list never arrives, say it anyway in whatever voice the browser
      // reaches for — silence is worse than a plain voice, and a passage being
      // read aloud would otherwise stop dead here.
      window.setTimeout(go, 3000);
      return;
    }

    // Cancelling and speaking in the same tick is a long-standing Chrome bug:
    // the new utterance is swallowed and nothing is heard at all. If she is
    // mid-sentence, stop her and start again a beat later.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      window.setTimeout(() => this.startSpeaking(text, onDone), 140);
      return;
    }
    this.startSpeaking(text, onDone);
  }

  private startSpeaking(text: string, onDone?: (ok: boolean) => void): void {
    const setting = this.voiceSetting();
    if (setting === "" || !this.canSpeak()) return;
    const synth = window.speechSynthesis;
    try {
      synth.resume(); // iOS suspends synthesis in the background
      const all = synth.getVoices();
      const chosen =
        setting === "auto"
          ? preferredVoice(all)
          : all.find((v) => v.voiceURI === setting) ??
            all.find((v) => v.name === setting) ??
            preferredVoice(all);

      // One utterance per line. Splitting at commas to fake breathing sounded
      // like the idea it was: browsers clip the opening of each utterance, so
      // she lost a syllable at the start of every clause, and the gaps between
      // them added up to a drawl.
      const utterance = new SpeechSynthesisUtterance(text);
      if (chosen) {
        utterance.voice = chosen;
        // WebKit resolves the voice by language as well as by object, and
        // falls back to the system default for the utterance's language when
        // the two disagree — which is one way an iPhone answers in a voice
        // nobody chose.
        utterance.lang = chosen.lang;
      }
      utterance.rate = this.rate();
      utterance.pitch = 1.0;

      let sawBoundary = false;
      utterance.onboundary = (e) => {
        if (e.name && e.name !== "word") return;
        sawBoundary = true;
        this.stopFallbackPulse();
        this.emitPulse();
      };
      utterance.onstart = () => {
        ambient.duck();
        this.emitSpeaking(true);
        this.emitPulse();
        // iOS and several remote voices never report boundaries. Give them a
        // moment to prove otherwise, then keep time ourselves.
        window.setTimeout(() => {
          if (!sawBoundary) this.startFallbackPulse(text);
        }, 500);
      };
      const done = (ok: boolean) => {
        ambient.unduck();
        this.stopFallbackPulse();
        this.emitSpeaking(false);
        onDone?.(ok);
      };
      utterance.onend = () => done(true);
      utterance.onerror = () => done(false);
      synth.speak(utterance);
    } catch {
      /* speech unavailable or blocked — the words are on screen anyway */
      onDone?.(false);
    }
  }

  /** Stop the sound without touching what she was in the middle of. */
  private cancelSpeech(): void {
    this.stopFallbackPulse();
    if (!this.canSpeak()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    ambient.unduck();
    this.emitSpeaking(false);
  }

  stopSpeaking(): void {
    if (this.reading.active) {
      this.reading = { ...this.reading, active: false };
      this.emitReading();
    }
    this.cancelSpeech();
  }

  // ---- reading a passage aloud ------------------------------------------

  /**
   * Read something through, line by line, so it can be stopped and picked up
   * again where it stopped.
   *
   * One utterance per line rather than one long one, because the start of an
   * utterance is the only place a browser reliably lets you back in: `pause()`
   * and `resume()` are honoured almost nowhere on a phone, and on iOS a paused
   * utterance is often simply never heard again. A line is a seam we already
   * have, and stopping mid-sentence and beginning that sentence again is how a
   * person reading aloud would do it anyway.
   */
  onReading(fn: ReadingListener): () => void {
    this.readingListeners.add(fn);
    fn(this.reading);
    return () => {
      this.readingListeners.delete(fn);
    };
  }

  private emitReading(): void {
    this.readingListeners.forEach((l) => l(this.reading));
  }

  readingState(): ReadingState {
    return this.reading;
  }

  /**
   * Start (or resume) reading a passage. `from` defaults to wherever she
   * stopped, so the audio button is a single toggle from the caller's side.
   */
  readAloud(lines: string[], from?: number): void {
    if (!this.canSpeak() || this.voiceSetting() === "" || lines.length === 0) return;
    const start = Math.min(Math.max(from ?? this.reading.index ?? 0, 0), lines.length - 1);
    this.passage = lines;
    this.claim(); // a passage is her whole attention; nothing talks across it
    this.speakLine(start);
  }

  private speakLine(i: number): void {
    const lines = this.passage;
    if (!lines) return;
    if (i >= lines.length) {
      this.finishReading();
      return;
    }
    this.reading = { index: i, active: true };
    this.emitReading();
    this.speak(lines[i], false, (ok) => {
      // Anything that moved on — a stop, a different passage, a new line —
      // owns her now; this callback is the ghost of an utterance that ended.
      if (this.passage !== lines || !this.reading.active || this.reading.index !== i) return;
      if (!ok) {
        this.pauseReading();
        return;
      }
      this.speakLine(i + 1);
    });
  }

  /** Stop, and remember the line — the next tap picks it up there. */
  pauseReading(): void {
    if (!this.reading.active) return;
    this.reading = { ...this.reading, active: false };
    this.emitReading();
    this.cancelSpeech();
  }

  /** Done with the passage entirely: forget where she was, hand her back. */
  stopReading(): void {
    // Nothing of ours is running — and the claim we would release may belong
    // to the walkthrough, so leave it where it is.
    if (!this.passage && this.reading.index === null) return;
    this.passage = null;
    this.reading = { index: null, active: false };
    this.emitReading();
    this.cancelSpeech();
    this.release();
  }

  /** She reached the end. The passage stays, so a later tap reads it again. */
  private finishReading(): void {
    this.reading = { index: null, active: false };
    this.emitReading();
    this.release();
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
