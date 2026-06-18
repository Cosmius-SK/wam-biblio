# biblio — a living journal

Speak or type a raw, unfiltered thought. An AI rewrites it into a coherent entry
you'll actually want to reread, files it into a self-organizing library, and —
over the coming phases — connects it to everything you've written before.

This is **Phase 1** (the core magic): voice/text capture → AI shaping → review →
local-first storage → a calm reading timeline. See the full roadmap in the plan.

## Stack
- **Next.js (App Router) + TypeScript + Tailwind + Framer Motion** — soothing, responsive PWA.
- **Dexie / IndexedDB** — local-first store; capture works offline, your entries stay on-device.
- **Claude** (`@anthropic-ai/sdk`) — the "brain", behind a Haiku↔Sonnet model **throttle**
  (`lib/ai/router.ts`) that keeps most calls cheap and escalates only when it matters.

## Getting started
```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

The app runs without a key, but shaping an entry needs `ANTHROPIC_API_KEY`.
Only your raw entry text goes to Claude (Anthropic does not train on API data).

## Privacy
- Entries live in your browser (IndexedDB). The server is stateless — it stores nothing.
- Voice transcription uses the browser's on-device speech engine (Phase 1).
- Only **sanitized scene prompts** (never raw text) will ever reach the free image tier (Phase 3).
- End-to-end encrypted sync is Phase 4.

## Sample entries
While we build out later phases, you can preview the experience with synthetic
data: on an empty timeline tap **"Preview with sample entries"**. They're clearly
marked and removable in one tap via the **"Clear samples"** banner. Erase them
before real use.

## Model throttle
`AI_MODEL_FLOOR` (default Haiku 4.5) handles most entries; the router escalates to
`AI_MODEL_CEILING` (default Sonnet 4.6) for rich, long, or significant moments, and
for deeper passes. Raise the ceiling to `claude-opus-4-8` anytime. Estimated cost at
journaling volume: ~$2–3/month; images free.

## Roadmap
- **Phase 1 (now):** capture + AI shaping + local timeline.
- **Phase 2:** embeddings, self-organizing themes/threads, ask-your-journal.
- **Phase 3:** AI scene images (Gemini free tier).
- **Phase 4:** end-to-end encrypted multi-device sync.
