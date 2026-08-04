"use client";

import { useEffect, useState } from "react";
import { maya, type MayaFrequency } from "@/lib/maya";

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
  const canSpeak = maya.canSpeak();

  useEffect(() => {
    setVoice(maya.voiceSetting());
    setFreq(maya.frequency());
    if (!maya.canSpeak()) return;
    const load = () => setVoices(maya.voices());
    load();
    // Voices arrive asynchronously in most browsers.
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function chooseVoice(v: string) {
    setVoice(v);
    maya.setVoice(v);
    if (v !== "") maya.say("This is my voice.", "observation", 4500);
  }

  function chooseFrequency(f: MayaFrequency) {
    setFreq(f);
    maya.setFrequency(f);
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
            <option value="auto">Auto — the calmest voice on this device</option>
            <option value="">Off — her words appear as text only</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted/80">
            Spoken by this device — free, offline, and never sent anywhere. Her words always
            appear on screen too, so nothing is lost with the sound off.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          This browser has no speech built in — Maya will write instead of speaking.
        </p>
      )}
    </div>
  );
}
