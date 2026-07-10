"use client";

/**
 * Generative ambient pad — pure Web Audio synthesis. No audio files, no
 * licensing, no network, no cost: soft detuned sine pads drifting through a
 * slow chord cycle behind a breathing low-pass filter.
 *
 * Gain staging: notes → filter → master (the volume knob) → limiter (safety
 * ceiling) → out. The master is the user-controlled volume; the limiter only
 * catches peaks that would clip, so raising the volume actually gets louder.
 *
 * A singleton so any component can control it — the voice recorder ducks it
 * during capture, and MusicToggle resumes it after the tab/phone wakes.
 */
type Listener = (playing: boolean) => void;

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

const DEFAULT_VOLUME = 0.7;
const VOL_KEY = "biblio_music_vol";
const ATTACK = 5; // seconds
const HOLD = 14;
const RELEASE = 8;
const NOTE_GAIN = 0.36; // per note (split across its two oscillators); limiter tames the sum

// Gentle, hopeful pads cycling around Am7 / Fmaj7 / G / C.
const CHORDS: number[][] = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 349.23],
  [196.0, 246.94, 293.66, 392.0],
  [130.81, 196.0, 261.63, 329.63],
];

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw != null) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    }
  } catch {
    /* SSR / private mode */
  }
  return DEFAULT_VOLUME;
}

class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private chordTimer: number | null = null;
  private active: Voice[] = [];
  private playing = false;
  private ducked = false;
  private chordIndex = 0;
  private listeners = new Set<Listener>();
  private userVolume = readStoredVolume();

  isPlaying(): boolean {
    return this.playing;
  }

  getVolume(): number {
    return this.userVolume;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l(this.playing));
  }

  /** Must be called from a user gesture the first time (autoplay policy). */
  toggle() {
    if (this.playing) this.stop();
    else this.start();
  }

  start() {
    if (this.playing) return;
    if (!this.ctx) this.setup();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (ctx.state === "suspended") void ctx.resume();
    this.playing = true;
    this.ducked = false;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.userVolume, ctx.currentTime, 1.5);
    this.playChord();
    this.emit();
  }

  stop() {
    if (!this.playing || !this.ctx || !this.master) return;
    this.playing = false;
    this.ducked = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.5);
    if (this.chordTimer !== null) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
    const fading = this.active;
    this.active = [];
    window.setTimeout(() => {
      fading.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      });
    }, 3000);
    this.emit();
  }

  /** Fade to silence while the mic/camera is in use. */
  duck() {
    if (!this.ctx || !this.master || !this.playing || this.ducked) return;
    this.ducked = true;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  /** Ease back in after recording is done. */
  unduck() {
    if (!this.ctx || !this.master || !this.playing || !this.ducked) return;
    this.ducked = false;
    this.master.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 1.0);
  }

  /**
   * Resume after the tab/phone wakes. Browsers suspend the audio context when
   * backgrounded (and iOS refuses to resume outside a user gesture) — so this
   * is called on focus and on the next tap, not just visibilitychange.
   */
  resume() {
    if (!this.ctx || !this.playing) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.ducked && this.master) {
      this.master.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 0.6);
    }
  }

  /** Set the volume (0–1); applies live if playing and persists per-device. */
  setVolume(v: number) {
    this.userVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(VOL_KEY, String(this.userVolume));
    } catch {
      /* private mode */
    }
    if (this.playing && !this.ducked && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 0.15);
    }
  }

  private setup() {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();

    const master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.4;

    // A very slow LFO makes the filter "breathe".
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / 26;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // Final safety limiter — only catches peaks near clipping, so the volume
    // knob keeps its full range.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    // notes → filter → master (volume) → limiter → out
    filter.connect(master).connect(limiter).connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.filter = filter;
  }

  private playChord() {
    if (!this.playing || !this.ctx || !this.filter) return;
    const ctx = this.ctx;
    const chord = CHORDS[this.chordIndex % CHORDS.length];
    this.chordIndex++;
    const now = ctx.currentTime;

    // Ease out the previous chord.
    for (const v of this.active) {
      v.gain.gain.setTargetAtTime(0, now, RELEASE / 4);
      const osc = v.osc;
      window.setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }, (RELEASE + 2) * 1000);
    }
    this.active = [];

    // Two slightly-detuned sines per note, for a soft chorus width.
    for (const freq of chord) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(NOTE_GAIN / chord.length / 2, now, ATTACK / 3);
        osc.connect(gain).connect(this.filter);
        osc.start(now);
        this.active.push({ osc, gain });
      }
    }

    this.chordTimer = window.setTimeout(() => this.playChord(), (ATTACK + HOLD) * 1000);
  }
}

export const ambient = new Ambient();
