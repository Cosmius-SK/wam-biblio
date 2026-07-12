"use client";

import SettingsShell from "@/components/SettingsShell";
import AiModeCard from "@/components/AiModeCard";
import ModelChooser from "@/components/ModelChooser";
import StylePicker from "@/components/StylePicker";
import UsageCard from "@/components/UsageCard";

export default function AiSettingsPage() {
  return (
    <SettingsShell title="AI" blurb="How much the AI does, and how it draws.">
      <AiModeCard />

      <div className="mt-4">
        <UsageCard />
      </div>

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Illustration model</h2>
        <p className="mt-1 text-sm text-muted">
          Which Gemini model draws your card illustrations. Refresh to pull the latest,
          pick one, and Update — or leave it on Auto.
        </p>
        <div className="mt-4">
          <ModelChooser />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Illustration style</h2>
        <p className="mt-1 text-sm text-muted">
          The look of your card illustrations. Three calm styles in biblio&rsquo;s palette —
          applies to new illustrations.
        </p>
        <div className="mt-4">
          <StylePicker />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Balance &amp; limits</h2>
        <p className="mt-1 text-sm text-muted">
          The authoritative numbers live with the providers — one tap away.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-lavender/40"
          >
            Anthropic credit ↗
          </a>
          <a
            href="https://aistudio.google.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-hairline bg-paper/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-lavender/40"
          >
            Gemini usage ↗
          </a>
        </div>
      </div>
    </SettingsShell>
  );
}
