/** Shared domain types for the living journal. */

/** The AI-structured shape of a single journal entry. */
export interface StructuredEntry {
  /** A short, evocative title for the entry. */
  title: string;
  /** The rewritten, coherent first-person entry, preserving the author's voice. */
  body: string;
  /** One-line summary, used for context retrieval and list previews. */
  summary: string;
  /** Recurring themes this entry touches (e.g. "work", "family", "doubt"). */
  themes: string[];
  /** A single dominant mood word (e.g. "hopeful", "restless", "tender"). */
  mood: string;
  /** People/places/things mentioned, for later correlation. */
  entities: string[];
  /** Whether this entry is significant enough to deserve a scene image (Phase 3). */
  significant: boolean;
  /**
   * A SANITIZED, evocative scene description for image generation — no names or
   * private identifiers. Only this ever leaves for the free image tier.
   */
  imagePrompt: string;
}

/** A full entry as persisted locally (structured fields + bookkeeping). */
export interface JournalEntry extends StructuredEntry {
  id: string;
  /** The original, unedited thought (voice transcript or typed). */
  raw: string;
  /** Epoch millis the entry was captured. */
  createdAt: number;
  /** Which Claude model produced this entry (e.g. "claude-haiku-4-5"). */
  model: string;
  /** How the raw input was captured. */
  source: "voice" | "text";
  /**
   * True for sample/demo entries seeded to preview the app. These are kept
   * separate so they can be erased in one action before real use.
   */
  demo?: boolean;
}

/** Lightweight context the client sends so Claude can connect a new thought to recent ones. */
export interface EntryContext {
  title: string;
  summary: string;
  themes: string[];
  mood: string;
  createdAt: number;
}

/** Request body for POST /api/structure. */
export interface StructureRequest {
  raw: string;
  source: "voice" | "text";
  /** Recent entries (most-recent-first) for lightweight, server-stateless context. */
  recent?: EntryContext[];
  /** User hint that this moment matters — biases the router toward the deeper model. */
  markedSignificant?: boolean;
}

/** Response body for POST /api/structure. */
export interface StructureResponse {
  entry: StructuredEntry;
  model: string;
  /** Token usage, surfaced so the UI can show real cost transparency. */
  usage?: { inputTokens: number; outputTokens: number };
}
