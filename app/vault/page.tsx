"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import PageBar from "@/components/PageBar";
import { db, getSetting, setSetting } from "@/lib/db";
import type { JournalEntry, Portrait, Reflection } from "@/lib/types";
import { encryptJSON, decryptJSON, isEncryptedBlob, syncId } from "@/lib/crypto";
import DriveConnect from "@/components/DriveConnect";

interface BackupPayload {
  app: "wam-biblio";
  v: 1;
  exportedAt: number;
  entries: JournalEntry[];
  reflections: Reflection[];
  /** Profile self-portraits (thumbnails + Drive pointers) for the timelapse. */
  portraits?: Portrait[];
  /** The photo encryption key, so other devices can open Drive photos. */
  mediaKey?: string;
}

/** Adopt an incoming photo key only when this device doesn't have one yet. */
async function adoptMediaKey(incoming?: string): Promise<void> {
  if (!incoming) return;
  const existing = await getSetting("mediaKey");
  if (!existing) await setSetting("mediaKey", incoming);
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
      const portraits = await db.portraits.toArray();
      if (entries.length === 0 && reflections.length === 0 && portraits.length === 0) {
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
        portraits,
        mediaKey: await getSetting("mediaKey"),
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
      if (Array.isArray(payload.portraits)) await db.portraits.bulkPut(payload.portraits);
      await adoptMediaKey(payload.mediaKey);
      setStatus(`Restored ${payload.entries.length} ${payload.entries.length === 1 ? "entry" : "entries"}. They're on your timeline now.`);
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pushCloud() {
    reset();
    if (passphrase.length < 6) {
      setError("Enter a passphrase of at least 6 characters first.");
      return;
    }
    setBusy(true);
    try {
      const entries = (await db.entries.toArray()).filter((e) => !e.id.startsWith("demo-"));
      const reflections = await db.reflections.toArray();
      const portraits = await db.portraits.toArray();
      if (entries.length === 0 && reflections.length === 0 && portraits.length === 0) {
        setError("Nothing real to sync yet (sample entries are skipped).");
        setBusy(false);
        return;
      }
      const payload: BackupPayload = {
        app: "wam-biblio",
        v: 1,
        exportedAt: Date.now(),
        entries,
        reflections,
        portraits,
        mediaKey: await getSetting("mediaKey"),
      };
      const blob = await encryptJSON(payload, passphrase);
      const id = await syncId(passphrase);
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, blob }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Sync failed.");
      }
      setStatus(`Synced ${entries.length} ${entries.length === 1 ? "entry" : "entries"} to the cloud, encrypted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sync.");
    } finally {
      setBusy(false);
    }
  }

  async function pullCloud() {
    reset();
    if (passphrase.length < 6) {
      setError("Enter the passphrase you synced with.");
      return;
    }
    setBusy(true);
    try {
      const id = await syncId(passphrase);
      const res = await fetch(`/api/sync?id=${id}`);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Couldn't reach sync.");
      }
      const data = (await res.json()) as { found?: boolean; blob?: unknown };
      if (!data.found || !isEncryptedBlob(data.blob)) {
        setError("No cloud backup found for this passphrase yet — push from another device first.");
        setBusy(false);
        return;
      }
      let payload: BackupPayload;
      try {
        payload = await decryptJSON<BackupPayload>(data.blob, passphrase);
      } catch {
        setError("Wrong passphrase for this cloud backup.");
        setBusy(false);
        return;
      }
      await db.entries.bulkPut(payload.entries);
      if (Array.isArray(payload.reflections)) await db.reflections.bulkPut(payload.reflections);
      if (Array.isArray(payload.portraits)) await db.portraits.bulkPut(payload.portraits);
      await adoptMediaKey(payload.mediaKey);
      setStatus(`Pulled ${payload.entries.length} ${payload.entries.length === 1 ? "entry" : "entries"} from the cloud.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't pull.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl"
    >
      <PageBar />
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

      <div className="mt-4 rounded-2xl border border-hairline/70 bg-surface/60 p-5">
        <h2 className="font-serif text-lg text-ink">Sync across devices</h2>
        <p className="mt-1 text-sm text-muted">
          Push an encrypted copy to the cloud, then pull it on another device with the
          same passphrase. The server only ever sees ciphertext.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={pushCloud}
            disabled={busy}
            className="flex-1 rounded-full bg-ink/90 px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            Push to cloud
          </button>
          <button
            type="button"
            onClick={pullCloud}
            disabled={busy}
            className="flex-1 rounded-full border border-hairline bg-paper/50 px-5 py-2.5 text-sm font-medium text-ink transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            Pull &amp; merge
          </button>
        </div>
      </div>

      <DriveConnect />

      <p className="mt-6 text-center text-xs text-muted/80">
        Your passphrase is the only key — to your file backups and your cloud sync alike.
        Keep it somewhere safe; it can&rsquo;t be recovered.
      </p>
    </motion.div>
  );
}
