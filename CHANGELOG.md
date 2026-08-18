# Changelog

Every release gets an entry here, written **before** it ships. This is the one
source of truth: the in-app "what's new" card reads from this file, so there is
never a second copy to drift.

Each entry has two halves, because it has two audiences:

- **What's new** — for the person using biblio. Plain words, no jargon, no file
  names. If a sentence needs a developer to explain it, rewrite it.
- **Under the hood** — for whoever maintains it. Still plain, but specific.

And, where it applies, **Notes** — anything that behaves differently, needs a
one-off action, or upgrades stored data.

Newest first. Dates are the day the work landed.

> Entries before 0.5.0 were reconstructed from the commit history when this file
> was started, so they are summaries rather than release-time notes.

---

## 0.7.0 — 18 August 2026

### What's new

- **Sign in with Google.** There's now a proper front door at `/welcome`. Your
  Google account is how biblio knows which journal is yours — no shared secret,
  nothing to remember, and it stays yours across future versions.
- **Your passcode still works.** Nothing has been taken away; both ways in are
  open.
- **See your devices.** Settings › Devices lists everything you've signed in on
  and when each was last used. You can rename them, and disconnect one you no
  longer have.
- **Honest about what disconnecting does.** It stops that device syncing and
  asks it to clear itself next time it's opened. It cannot reach a phone that's
  switched off or never opened again — the screen says so, in those words.

### Under the hood

- `lib/users/session.ts` signs an HttpOnly cookie with Web Crypto HMAC, so the
  Edge middleware can verify it without a Node dependency or a round trip to
  Google on every request.
- `/api/auth/session` verifies the access token with Google once, checks the
  allowlist, registers the device and issues the cookie.
- The allowlist lives in the Blob store (`users/allowed.json`) with
  `ALLOWED_USERS` as a first-deploy seed — people are not deployment secrets.
- **Both doors open at once, on purpose.** The passcode is not removed in the
  release that adds sign-in; see `docs/releases.md`, "Cutovers".
- With no allowlist configured the Google door stays shut, so enabling it is
  always a deliberate act rather than a side effect of deploying.

### Fixed

- **Drafts could not actually sync.** The sync API only accepted record types
  `e`, `p`, `r` and `k`, so every draft push was rejected with a 400 the client
  never showed. Drafts saved locally but never left the device.

### Notes

- Two new environment variables: `AUTH_SECRET` (falls back to `APP_PASSCODE`)
  and `ALLOWED_USERS`. Without them, sign-in simply isn't offered and everything
  behaves exactly as before.
- Everyone signing in must also be a **Test user** on the Google OAuth consent
  screen, or Google blocks them before biblio ever sees the request.

---

## 0.6.0 — 18 August 2026

### What's new

- **Maya notices when the page goes quiet.** If nothing has moved for a while
  she asks whether you're still there — and what she says depends on where you
  are. On the writing page she assumes you're thinking, not gone. In the gallery
  she wonders if you've found something you'd forgotten.
- **Answering is one tap** — a small mark beside her words, or simply touching
  anything at all. She isn't testing you.
- **Say nothing and she closes the book**: the visit ends and, if you use the
  fingerprint or face lock, the app locks. Whatever you were writing is already
  saved.
- **You choose the wait** — 5, 10, 20 or 30 minutes, or never, in
  Settings › Maya. Answer once and she leaves you alone for longer next time.
- **She mentions an unfinished draft** when you come back after a while. Once a
  day at most, and never while you're already looking at it.

### Under the hood

- `presenceAsk()` in `lib/mayaLines.ts` composes per-surface lines from parts,
  with a no-repeat memory. The surface comes from the pathname, so no context
  plumbing was needed.
- Answer chips are contextual, never a mood rating — a word on the capture
  screen rather than faces. Which one was tapped is **not recorded**; see
  `docs/user-management/privacy.md`.
- `maya.ask()` carries an answer callback and a silence callback; the silence
  path flushes the draft, ends the session at the last real interaction, and
  relocks via a new `biblio-relock` event that `BioLock` listens for.
- Confirmed stillness is credited to the session; unconfirmed stillness is not.
  The idle window grows to 2× then 3× after each confirmation.

### Notes

- If Maya is set to Silent she doesn't ask, and a quiet screen simply stops the
  clock as before.

---

## 0.5.0 — 18 August 2026

### What's new

- **Your writing is no longer lost.** Start an entry, put the phone down, take a
  call, close the tab — it is still there when you come back. biblio saves what
  you are writing as you write it.
- **Start on one device, finish on another.** A half-written entry now travels
  with you. Begin a thought on your phone and pick it up on your laptop.
- **Photos come with it.** Pictures are saved into your own Google Drive the
  moment you attach them, so they are waiting on the other device too — and
  keeping an entry no longer pauses while photos upload.
- **A dot on the ✎ button** when something unfinished is waiting, so you know
  without going to look.
- **Coming back is quiet.** The page is simply already filled in, with a line
  saying when you left it. If it has been sitting more than a week, biblio asks
  first rather than surprising you with an old thought.
- **Discard this draft** — one tap, when a thought turns out not to be worth
  writing. Any photos you had attached are removed too.

### Under the hood

- New `lib/drafts.ts`: a single draft in a new Dexie table, debounced local
  writes at 800 ms and a flush on `visibilitychange` (the reliable signal in an
  installed PWA, unlike `beforeunload`).
- Drafts sync as record type `"d"` through the existing encrypted pipeline.
  Divergence between two devices joins both texts rather than picking a winner —
  nothing in this feature may discard a sentence.
- `PhotoAttach` now encrypts and uploads on attach, so a draft carries
  `EntryPhoto` references instead of blobs. Abandoned drafts clean their photos
  out of Drive, best effort.
- New `lib/session.ts`: sessions measured as *attended* use. The clock runs only
  while the document is visible, credits two minutes of stillness so reading
  counts, and discards any single delta longer than the idle threshold so a
  suspended laptop cannot invent an evening. Device-local, numbers only.
- Dexie schema v7 adds `drafts` and `sessions`. Additive; older builds ignore
  both.

### Notes

- The database upgrades itself on first open. Nothing to do.
- Photos now need Google Drive connected *at the moment you attach them* rather
  than when you keep the entry. The picker already told you if it wasn't.

---

## 0.4.0 — August 2026 · Maya, and a layout for bigger screens

### What's new

- **Maya arrives** — a quiet presence in the footer who greets you, notices
  patterns once your journal is old enough to have any, and can speak aloud in a
  woman's voice if you want her to.
- **A laptop layout**: one control bar, a full-width journal, and book mode as a
  real two-page spread.
- **The header, bar and footer stay put** instead of scrolling away.
- **A quotation in the footer** each day, with a slow band of light crossing it.
- **Filters open as a proper drop-down** you can tap away from.

### Under the hood

- `lib/maya.ts` singleton with voice selection, ambient ducking and iOS priming;
  `lib/mayaLines.ts` for her words and `lib/mayaObserve.ts` for local-only
  pattern detection.
- Fixed chrome with matching spacers; `components/PageBar.tsx` owns the tabs.
- Theme resolution stamped deterministically before first paint.

---

## 0.3.0 — July 2026 · The journal as a book

### What's new

- **Book mode** — flip through your journal a page at a time, with long entries
  flowing onto further leaves.
- **Three tabs**: Timeline, Gallery and Ask. Themes became a filter.
- **Settings redesigned** as a hub with focused pages.
- **Illustrations** for entries, with a style picker and a choice of which image
  leads the card.
- **An itemised record of what AI has cost you**, in Settings › AI.

### Under the hood

- CSS multi-column pagination for book pages; per-leaf column counts on desktop.
- Gemini model discovery at request time rather than a hardcoded model id.
- Usage ledger in a new `ailog` table.

---

## 0.2.0 — July 2026 · Sync, and an account

### What's new

- **Sign in with Google** and your journal reassembles itself on a new device —
  nothing to remember, nothing to copy across.
- **Photos** attach to entries, encrypted into your own Google Drive.
- **A biometric lock** for the app on this device.

### Under the hood

- Differential sync: one encrypted blob per record, a local ledger of content
  hashes, tombstones for deletions, real byte progress.
- The sync key lives in the account's hidden Drive `appDataFolder`.
- `lib/blobStore.ts` resolves whether the Blob store is private or public.

---

## 0.1.0 — 2026 · The first four phases

### What's new

Capture a messy thought by voice or text; Claude shapes it into a coherent
entry you review before keeping. Themes group your writing, a Reflection
summarises where you are, and you can ask your own journal questions. Encrypted
backup and restore.

### Under the hood

Next.js App Router, Dexie/IndexedDB as the source of truth, stateless AI routes,
Web Crypto for end-to-end encryption, and a sample mode so nothing bills until
you opt in.
