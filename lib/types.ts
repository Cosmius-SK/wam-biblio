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

/** A place picked from geocoding results (never free text). */
export interface EntryPlace {
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

/** A full entry as persisted locally (structured fields + bookkeeping). */
export interface JournalEntry extends StructuredEntry {
  id: string;
  /** The original, unedited thought (voice transcript or typed). */
  raw: string;
  /** Epoch millis of the moment the entry is ABOUT (backdatable; drives ordering). */
  createdAt: number;
  /** Epoch millis the entry was actually captured (bookkeeping). */
  recordedAt?: number;
  /** IANA time zone the entry was written in (e.g. "Asia/Tokyo") — preserves local wall-clock. */
  timezone?: string;
  /** Where this moment happened, if the writer chose a place. */
  place?: EntryPlace;
  /** Which Claude model produced this entry (e.g. "claude-haiku-4-5"). */
  model: string;
  /** How the raw input was captured. */
  source: "voice" | "text";
  /** A generated scene image (data URL) — set in live mode; otherwise rendered on the fly. */
  image?: string;
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
  /** Human-readable date the thought is about (context only, e.g. "Sat Jun 14 2026"). */
  occurredAt?: string;
  /** Label of the chosen place (context only, e.g. "Lisbon, Portugal"). */
  placeName?: string;
}

/** Response body for POST /api/structure. */
export interface StructureResponse {
  entry: StructuredEntry;
  model: string;
  /** Token usage, surfaced so the UI can show real cost transparency. */
  usage?: { inputTokens: number; outputTokens: number };
}

/** A compact entry the client sends to AI features that read across entries. */
export interface EntryRef {
  id: string;
  title: string;
  summary: string;
  body: string;
  themes: string[];
  mood: string;
  createdAt: number;
}

/** POST /api/ask — question your journal (RAG; retrieval happens on the client). */
export interface AskRequest {
  question: string;
  entries: EntryRef[];
}
export interface AskResponse {
  answer: string;
  /** Entry ids the answer draws on. */
  citations: string[];
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** POST /api/synthesis — a gentle "state of you" reflection over recent entries. */
export interface SynthesisRequest {
  entries: EntryRef[];
}
export interface SynthesisResponse {
  title: string;
  reflection: string;
  themes: string[];
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** A persisted reflection (kept locally so the user can revisit it). */
export interface Reflection {
  id: string;
  createdAt: number;
  title: string;
  reflection: string;
  themes: string[];
}
