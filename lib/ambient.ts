"use client";

/**
 * Generative ambient pad — pure Web Audio synthesis. No audio files, no
 * licensing, no network, no cost: soft detuned sine pads drifting through a
 * slow chord cycle behind a breathing low-pass filter.
 *
 * A singleton so any component can duck it: the voice recorder (and later the
 * camera) calls duck()/unduck() so music never bleeds into a recording.
 */
type Listener = (playing: boolean) => void;

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

const VOLUME = 0.22; // soft, but present in a quiet room (tamed by a compressor)
const ATTACK = 5; // seconds
const HOLD = 14;
const RELEASE = 8;

// Gentle, hopeful pads cycling around Am7 / Fmaj7 / G / C.
const CHORDS: number[][] = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 349.23],
  [196.0, 246.94, 293.66, 392.0],
  [130.81, 196.0, 261.63, 329.63],
];

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

  isPlaying(): boolean {
    return this.playing;
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
    this.master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.5);
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
    this.master.gain.setTargetAtTime(VOLUME, this.ctx.currentTime, 1.0);
  }

  /**
   * Resume after the tab returns to the foreground. Browsers suspend the audio
   * context when a tab is backgrounded (aggressively on mobile), which is why
   * the pad would go silent and not come back — resuming here fixes that.
   */
  resume() {
    if (!this.ctx || !this.playing) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.ducked && this.master) {
      this.master.gain.setTargetAtTime(VOLUME, this.ctx.currentTime, 0.6);
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
    filter.frequency.value = 1050;
    filter.Q.value = 0.4;

    // A very slow LFO makes the filter "breathe".
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / 26;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // Gentle compression lets the pad sit at an audible level without clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.05;
    comp.release.value = 0.4;

    filter.connect(comp).connect(master).connect(ctx.destination);
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
        gain.gain.setTargetAtTime(0.16 / chord.length, now, ATTACK / 3);
        osc.connect(gain).connect(this.filter);
        osc.start(now);
        this.active.push({ osc, gain });
      }
    }

    this.chordTimer = window.setTimeout(() => this.playChord(), (ATTACK + HOLD) * 1000);
  }
}

export const ambient = new Ambient();
