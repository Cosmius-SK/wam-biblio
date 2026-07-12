"use client";

import SettingsShell from "@/components/SettingsShell";

const VERSION = "0.1.0";

export default function AboutSettingsPage() {
  return (
    <SettingsShell title="About biblio" blurb="A living journal.">
      <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <p className="font-serif text-lg text-ink">
          biblio <span className="text-sm text-muted">v{VERSION}</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Speak or type a raw thought; it comes back to you as something whole — and your
          journal quietly organizes itself around what you write.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Your privacy</h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-ink/80">Local-first.</span> Entries live on your device;
            the app works offline.
          </li>
          <li>
            <span className="text-ink/80">Encrypted everywhere else.</span> Sync and backups
            are end-to-end encrypted; photos are encrypted into your own Google Drive. Servers
            only ever see ciphertext.
          </li>
          <li>
            <span className="text-ink/80">AI only when you ask.</span> Raw journal text goes
            to Claude alone; images use a sanitized scene description, never your words.
          </li>
        </ul>
      </div>
    </SettingsShell>
  );
}
