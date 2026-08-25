"use client";

import { useCallback, useEffect, useState } from "react";
import {
  maya,
  isNaturalVoice,
  voiceGender,
  voiceKey,
  voiceTier,
  type MayaFrequency,
  type VoiceChoices,
} from "@/lib/maya";
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
 * One line in the voice picker. The name and language are what someone
 * recognises from their phone's own settings, so they are what we show.
 */
function voiceOption(v: SpeechSynthesisVoice) {
  const tier = voiceTier(v);
  // Apple lists "Ava" three times over. Say which one this is, unless the
  // name already does.
  const quality =
    (tier === "premium" || tier === "enhanced") && !v.name.toLowerCase().includes(tier)
      ? ` \u2014 ${tier === "premium" ? "Premium" : "Enhanced"}`
      : "";
  return (
    <option key={voiceKey(v)} value={v.voiceURI}>
      {isNaturalVoice(v) ? "★ " : ""}
      {v.name}
      {quality} ({v.lang})
      {v.default ? " · your device default" : ""}
      {voiceGender(v) === "him" ? " · a man\u2019s voice" : ""}
    </option>
  );
}

/**
 * Settings › Maya: whether she speaks aloud, in whose voice, and how often
 * she says anything at all.
 */
export default function MayaCard() {
  const [voices, setVoices] = useState<VoiceChoices>({ hers: [], others: [] });
  const [auto, setAuto] = useState<SpeechSynthesisVoice | undefined>();
  const [voice, setVoice] = useState("auto");
  const [freq, setFreq] = useState<MayaFrequency>("quiet");
  const [idle, setIdle] = useState(10);
  const [showTour, setShowTour] = useState(false);
  const [rate, setRate] = useState(0.92);
  const canSpeak = maya.canSpeak();

  // Hers first, then everything else the device has. Filtering the list down
  // to the names we recognise as women hid voices people had downloaded on
  // purpose — a guess belongs in the default, not in the gate.
  const refresh = useCallback(() => {
    setVoices(maya.voiceList());
    setAuto(maya.autoVoice());
  }, []);

  useEffect(() => {
    setVoice(maya.voiceSetting());
    setFreq(maya.frequency());
    setIdle(idleMinutes());
    setRate(maya.rate());
    if (!maya.canSpeak()) return;
    refresh();
    // Voices arrive asynchronously in most browsers.
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [refresh]);

  const all = [...voices.hers, ...voices.others];
  const total = all.length;

  /**
   * Some platforms only publish their full list once speech has been used, so
   * knock first and look again a moment later. This is also the honest answer
   * to "my downloaded voice isn't here": the list below is the whole of what
   * the browser is given, and if a voice is missing from it, it was never
   * offered to us.
   */
  function recheckVoices() {
    maya.nudgeVoices();
    window.setTimeout(refresh, 700);
  }

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

  function chooseRate(n: number) {
    setRate(n);
    maya.setRate(n);
    maya.prime();
    maya.say("This is how quickly I'll say things.", "observation", 5000);
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
            <option value="auto">
              {auto
                ? `Auto — she\u2019ll use ${auto.name} (${auto.lang})`
                : "Auto — the most human woman\u2019s voice on this device"}
            </option>
            <option value="">Off — her words appear as text only</option>
            {voices.hers.length > 0 && (
              <optgroup label={"Women\u2019s voices"}>
                {voices.hers.map(voiceOption)}
              </optgroup>
            )}
            {voices.others.length > 0 && (
              <optgroup label="Everything else on this device">
                {voices.others.map(voiceOption)}
              </optgroup>
            )}
          </select>

          {voice !== "" && (
            <div className="mt-4">
              <label className="text-sm text-muted" htmlFor="maya-rate">
                How quickly she speaks
              </label>
              <input
                id="maya-rate"
                type="range"
                min={0.7}
                max={1.15}
                step={0.02}
                value={rate}
                onChange={(e) => chooseRate(Number(e.target.value))}
                className="mt-2 w-full accent-lavender"
              />
              <div className="flex justify-between text-xs text-muted/70">
                <span>Unhurried</span>
                <span>Brisk</span>
              </div>
            </div>
          )}

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
            A voice you downloaded yourself can still be missing here. iPhone keeps its
            Premium and Enhanced voices for its own reading features and hands the browser
            only the small &ldquo;compact&rdquo; ones — no website can reach the rest. The
            list below is the whole of what this device offers biblio.
          </p>

          <details className="mt-2 rounded-xl border border-hairline/70 bg-paper/30 px-3 py-2">
            <summary className="cursor-pointer list-none text-xs text-muted hover:text-ink">
              What this device shares — {total} {total === 1 ? "voice" : "voices"}
            </summary>
            <button
              type="button"
              onClick={recheckVoices}
              className="mt-2 rounded-full border border-hairline bg-paper/50 px-3 py-1.5 text-xs text-ink transition-colors hover:border-lavender/40"
            >
              Check again
            </button>
            <ul className="mt-2 space-y-1.5">
              {all.map((v) => (
                <li key={voiceKey(v)} className="border-t border-hairline/40 pt-1.5">
                  <span className="text-xs text-ink/80">
                    {v.name} · {v.lang}
                    {v.default ? " · device default" : ""}
                  </span>
                  {/* The identifier is where Apple says which quality this is,
                      so it is the one thing worth showing verbatim. */}
                  <span className="block break-all font-mono text-2xs leading-4 text-muted/60">
                    {v.voiceURI}
                  </span>
                </li>
              ))}
            </ul>
          </details>
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
