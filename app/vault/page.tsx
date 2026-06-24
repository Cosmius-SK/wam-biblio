"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/db";
import type { JournalEntry, Reflection } from "@/lib/types";
import { encryptJSON, decryptJSON, isEncryptedBlob } from "@/lib/crypto";

interface BackupPayload {
  app: "wam-biblio";
  v: 1;
  exportedAt: number;
  entries: JournalEntry[];
  reflections: Reflection[];
}

export default function VaultPage() {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStatus(null);
    setError(null);
  }

  async function exportBackup() {
    reset();
    if (passphrase.length < 6) {
      setError("Choose a passphrase of at least 6 characters first.");
      return;
    }
    setBusy(true);
    try {
      const entries = (await db.entries.toArray()).filter((e) => !e.id.startsWith("demo-"));
      const reflections = await db.reflections.toArray();
      if (entries.length === 0 && reflections.length === 0) {
        setError("Nothing real to back up yet (sample entries are skipped).");
        setBusy(false);
        return;
      }
      const payload: BackupPayload = {
        app: "wam-biblio",
        v: 1,
        exportedAt: Date.now(),
        entries,
        reflections,
      };
      const blob = await encryptJSON(payload, passphrase);
      const date = new Date().toISOString().slice(0, 10);
      const text = JSON.stringify(blob);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `biblio-backup-${date}.biblio.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Encrypted ${entries.length} ${entries.length === 1 ? "entry" : "entries"} and downloaded your backup.`);
    } catch {
      setError("Couldn't create the backup.");
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File) {
    reset();
    if (passphrase.length < 6) {
      setError("Enter the passphrase you used for this backup.");
      return;
    }
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!isEncryptedBlob(parsed)) {
        setError("That doesn't look like a biblio backup file.");
        setBusy(false);
        return;
      }
      let payload: BackupPayload;
      try {
        payload = await decryptJSON<BackupPayload>(parsed, passphrase);
      } catch {
        setError("Wrong passphrase, or the file is corrupted.");
        setBusy(false);
        return;
      }
      if (payload.app !== "wam-biblio" || !Array.isArray(payload.entries)) {
        setError("This backup is missing its journal data.");
        setBusy(false);
        return;
      }
      await db.entries.bulkPut(payload.entries);
      if (Array.isArray(payload.reflections)) await db.reflections.bulkPut(payload.reflections);
      setStatus(`Restored ${payload.entries.length} ${payload.entries.length === 1 ? "entry" : "entries"}. They're on your timeline now.`);
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-7 mt-4">
        <h1 className="font-serif text-3xl text-ink">Your vault</h1>
        <p className="mt-1 text-muted">
          Move your journal between devices with an encrypted backup — nothing leaves
          your device unencrypted.
        </p>
      </div>

      <label className="block text-sm font-medium text-ink">Passphrase</label>
      <input
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="a phrase only you know"
        className="mt-2 w-full rounded-xl border border-hairline bg-surface/70 px-4 py-3 text-ink placeholder:text-muted/60 focus:border-lavender/60"
      />
      <p className="mt-2 text-xs text-muted">
        This encrypts and opens your backup. It&rsquo;s never stored or sent anywhere — if you
        lose it, the backup can&rsquo;t be recovered.
      </p>

      {error && <p className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</p>}
      {status && <p className="mt-4 rounded-xl bg-sage/15 px-4 py-3 text-sm text-sage">{status}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
          <h2 className="font-serif text-lg text-ink">Back up</h2>
          <p className="mt-1 text-sm text-muted">
            Download an encrypted copy of your real entries and reflections.
          </p>
          <button
            type="button"
            onClick={exportBackup}
            disabled={busy}
            className="mt-4 w-full rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            {busy ? "Working…" : "Download encrypted backup"}
          </button>
        </div>

        <div className="rounded-2xl border border-hairline/70 bg-surface/60 p-5">
          <h2 className="font-serif text-lg text-ink">Restore</h2>
          <p className="mt-1 text-sm text-muted">
            Open a backup file on this device. Entries merge with what&rsquo;s here.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.biblio,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-4 w-full rounded-full border border-hairline bg-paper/50 px-5 py-2.5 text-sm font-medium text-ink transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            Choose a backup file…
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted/80">
        Live multi-device sync is coming next. For now, this gives you a portable,
        encrypted copy you control.
      </p>
    </motion.div>
  );
}
