"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchImageModels, getPreferredModel, setPreferredModel } from "@/lib/models";

/**
 * Pick which Gemini model draws illustrations: a live dropdown of available
 * models, a Refresh to re-pull the list, and Update to save the choice.
 * "Auto" hands the decision back to the server (newest available). Reused in
 * Settings and in the on-card failure dialog.
 */
export default function ModelChooser({ onUpdated }: { onUpdated?: (model: string) => void }) {
  const [models, setModels] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ msg: string; hint?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const pref = await getPreferredModel();
    const list = await fetchImageModels();
    // Keep the current pin selectable even if discovery didn't surface it.
    const merged = [...new Set([pref, ...list.models].filter(Boolean))];
    setModels(merged);
    setSelected(pref);
    if (list.error) setError({ msg: list.error, hint: list.hint });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update() {
    setSaving(true);
    await setPreferredModel(selected);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    onUpdated?.(selected);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading}
          aria-label="Illustration model"
          className="min-w-0 flex-1 rounded-xl border border-hairline bg-paper/50 px-3 py-2 text-sm text-ink focus:border-lavender/60 disabled:opacity-50"
        >
          <option value="">Auto — newest available</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Refresh models"
          title="Refresh the list of available models"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface/60 text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={loading ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={update}
          disabled={loading || saving}
          className="shrink-0 rounded-full bg-ink/90 px-4 py-2 text-sm font-medium text-paper shadow-soft transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-50"
        >
          {saved ? "Saved" : saving ? "Saving…" : "Update"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-xl bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
          <p>{error.msg}</p>
          {error.hint && <p className="mt-1 text-terracotta/80">{error.hint}</p>}
        </div>
      )}
    </div>
  );
}
