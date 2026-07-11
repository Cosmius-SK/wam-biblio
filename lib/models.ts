"use client";

import { getSetting, setSetting } from "./db";

/**
 * The chosen Gemini image model is a per-device preference. Empty means "auto"
 * — the server picks the newest available. The Settings picker and the on-card
 * failure dialog both read/write it here.
 */
export interface ModelList {
  models: string[];
  error?: string;
  hint?: string;
}

/** Ask the server which image models this key can use right now. */
export async function fetchImageModels(): Promise<ModelList> {
  try {
    const res = await fetch("/api/image", { cache: "no-store" });
    const data = (await res.json()) as ModelList;
    return {
      models: Array.isArray(data.models) ? data.models : [],
      error: data.error,
      hint: data.hint,
    };
  } catch {
    return { models: [], error: "Couldn't load the model list.", hint: "Check your connection and retry." };
  }
}

/** The preferred model id, or undefined/"" for auto. */
export async function getPreferredModel(): Promise<string> {
  return (await getSetting("imageModel")) ?? "";
}

export async function setPreferredModel(model: string): Promise<void> {
  await setSetting("imageModel", model.trim());
}
