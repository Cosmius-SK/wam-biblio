"use client";

import { useEffect, useState } from "react";
import { maya, voiceQuality, type MayaFrequency } from "@/lib/maya";
import { idleMinutes, setIdleMinutes } from "@/lib/session";
import { restartTour } from "@/lib/tour";
import Tour from "./tour/Tour";

/** How long a quiet screen waits before she asks. 0 means she never does. */
const IDLE_CHOICES: { value: number; label: string }[] = [
  { value: 5, label: "After 5 minutes" },
  { value: 10, label: "After 10 minutes" },
  { value: 20, label: "After 20 minutes" },
  { value: 30, label: "After 30 minutes" },
  { value: 0, label: "Never ask" },
];

const FREQUENCIES: { key: MayaFrequency; label: string; hint: string }[] = [
  { key: "quiet", label: "Quiet", hint: "Moments that matter" },
  { key: "often", label: "Often", hint: "A little more" },
  { key: "silent", label: "Silent", hint: "Never speaks up" },
];

/**
 * Settings › Maya: whether she speaks aloud, in whose voice, and how often
 * she says anything at all.
 */
export default function MayaCard() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("auto");
  const [freq, setFreq] = useState<MayaFrequency>("quiet");
  const [idle, setIdle] = useState(10);
  const [showTour, setShowTour] = useState(false);
  const canSpeak = maya.canSpeak();

  useEffect(() => {
    setVoice(maya.voiceSetting());
    setFreq(maya.frequency());
    setIdle(idleMinutes());
    if (!maya.canSpeak()) return;
    // Best first: every platform ships old formant voices alongside neural
    // ones, and the list order is no guide to which is which.
    const load = () =>
      setVoices([...maya.femaleVoices()].sort((a, b) => voiceQuality(b) - voiceQuality(a)));
    load();
    // Voices arrive asynchronously in most browsers.
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function chooseVoice(v: string) {
    setVoice(v);
    maya.setVoice(v);
  }

  /**
   * iOS only lets speech begin inside a real user gesture, so hearing her is
   * its own button — speaking straight out of the tap, never after an await.
   */
  function hearHer() {
    maya.prime();
    maya.say("Hello. I'm Maya — I'll be here while you write.", "observation", 6000);
  }

  function chooseFrequency(f: MayaFrequency) {
    setFreq(f);
    maya.setFrequency(f);
  }

  function chooseIdle(n: number) {
    setIdle(n);
    setIdleMinutes(n);
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
      <h2 className="font-serif text-lg text-ink">Maya</h2>
      <p className="mt-1 text-sm text-muted">
        The presence in your journal — the breathing light, and the voice beside it. She
        notices things only from what&rsquo;s on this device, and only when there&rsquo;s
        something real to notice.
      </p>

      <p className="mt-5 text-xs uppercase tracking-wide text-muted/70">How often she speaks up</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {FREQUENCIES.map((f) => {
          const active = freq === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => chooseFrequency(f.key)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-center transition-colors ${
                active
                  ? "border-lavender/60 bg-lavender/10"
                  : "border-hairline bg-paper/40 hover:border-lavender/30"
              }`}
            >
              <span className={`block text-sm font-medium ${active ? "text-ink" : "text-ink/80"}`}>
                {f.label}
              </span>
              <span className="mt-0.5 block text-2xs text-muted">{f.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs uppercase tracking-wide text-muted/70">Her voice</p>
      {canSpeak ? (
        <>
          <select
            value={voice}
            onChange={(e) => chooseVoice(e.target.value)}
            aria-label="Maya's voice"
            className="mt-2 w-full cursor-pointer rounded-xl border border-hairline bg-paper/50 px-3 py-2.5 text-sm text-ink focus:border-lavender/60 focus:outline-none"
          >
            <option value="auto">Auto — the most human woman&rsquo;s voice on this device</option>
            <option value="">Off — her words appear as text only</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {voiceQuality(v) >= 100 ? "★ " : ""}
                {v.name} ({v.lang})
              </option>
            ))}
          </select>

          {voice !== "" && (
            <button
              type="button"
              onClick={hearHer}
              className="mt-3 rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-lavender/40"
            >
              Hear her
            </button>
          )}

          <p className="mt-3 text-xs text-muted/80">
            Spoken by this device — free and never sent anywhere. Her words always appear on
            screen too, so nothing is lost with the sound off.
          </p>
          <p className="mt-1.5 text-xs text-muted/70">
            ★ marks the newer, more human-sounding voices. If none are starred here, your
            device only has the older robotic ones — iPhone can download better ones under
            Settings › Accessibility › Spoken Content › Voices.
          </p>
          <p className="mt-1.5 text-xs text-muted/70">
            On iPhone the silent switch mutes her too — if she looks like she&rsquo;s speaking
            but you hear nothing, that&rsquo;s usually why.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          This browser has no speech built in — Maya will write instead of speaking.
        </p>
      )}

      <div className="mt-6 border-t border-hairline/60 pt-5">
        <h3 className="text-sm font-medium text-ink">A look around</h3>
        <p className="mt-1 text-sm text-muted">
          She&rsquo;ll walk you through biblio again from the beginning — useful after an
          update, or if you&rsquo;d rather not have skipped it the first time.
        </p>
        <button
          type="button"
          onClick={() => {
            void restartTour();
            setShowTour(true);
          }}
          className="mt-3 rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm text-ink transition-colors hover:border-lavender/40"
        >
          Maya, show me around
        </button>
        {showTour && <Tour force onClose={() => setShowTour(false)} />}
      </div>

      <div className="mt-6 border-t border-hairline/60 pt-5">
        <h3 className="text-sm font-medium text-ink">If the page goes quiet</h3>
        <p className="mt-1 text-sm text-muted">
          When nothing has moved for a while, Maya asks whether you&rsquo;re still there.
          Answer and she leaves you alone for longer next time; say nothing and she closes
          the book — your writing is already saved either way.
        </p>
        <select
          value={idle}
          onChange={(e) => chooseIdle(Number(e.target.value))}
          aria-label="When Maya asks if you're still there"
          className="mt-3 w-full cursor-pointer rounded-xl border border-hairline bg-paper/50 px-4 py-3 text-ink focus:border-lavender/60 focus:outline-none"
        >
          {IDLE_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {idle === 0 && (
          <p className="mt-2 text-xs text-terracotta/90">
            Your journal stays open until you close it yourself.
          </p>
        )}
      </div>
    </div>
  );
}
