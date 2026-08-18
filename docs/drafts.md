# Drafts

**Status:** persistence, restore, discard, the header dot and cross-device sync
are **built** (`lib/drafts.ts`, `components/CaptureComposer.tsx`, record type
`"d"` in `lib/sync.ts`). Photos now upload at attach time, so they travel with
the draft. **Maya's nudge is built** too. Still to come: persisting the
*shaped* result, so walking away mid-review does not cost the AI call.

## The problem

Everything on the capture screen lives in React state and nowhere else
(`components/CaptureComposer.tsx`): `text`, `when`, `place`, `photos`, the AI
mode. Navigate away, take a call, let iOS reclaim the tab, refresh — it is gone.

Two things make it worse than it first looks:

- **The review screen is volatile too.** Shape an entry, walk away before
  tapping *Keep it*, and an AI call that was paid for is lost with it.
- **The idle lock depends on this.** A 10-minute presence check that closes the
  app is only humane if drafts survive it. Draft persistence is a
  **prerequisite** for the lock, not a companion feature.

## The shape

**One draft.** Not a list — a journal with a pile of half-thoughts becomes a
pile of guilt. Revisit only if users ask for more.

**Its own Dexie table**, not an entry with a flag. One missed filter and
someone's half-formed thought appears in their journal. The photo field reuses
`EntryPhoto[]` so there is no conversion at save time.

**Saved** on a ~800ms debounce while typing, **and immediately on
`visibilitychange`** — the second is what actually catches "put the phone down",
since `beforeunload` is unreliable in an installed PWA.

**Cleared** on a successful save, and on explicit discard. Both **tombstone**,
so the draft also disappears from the other device rather than leaving a ghost
of something already written.

**Delete draft** is explicit and easy to find — same action as "start fresh" on
the capture screen. Someone who decides a thought is not worth writing should be
able to say so.

**No silent expiry, ever.** No thirty-day cleanup, no "we tidied this away". If
they wrote it, it stays until they decide otherwise.

## Drafts sync

The purpose of biblio is catching thoughts before they evaporate. A draft
trapped on one device is a draft that can still evaporate — and the real use
case is ordinary: **start on the phone, finish on the laptop.**

- Words, AI mode, when and where sync as a small encrypted record, type `d`,
  through the existing pipeline. Same key, ciphertext only.
- Pushed on a debounce of a few seconds plus on `visibilitychange`. Cheap.
- **Divergence never picks a winner destructively.** Newest wins only when one
  side is clearly the ancestor of the other. On a genuine conflict both are
  kept, joined, and the writer tidies it. Slightly untidy beats losing words.

### Photos sync too

An earlier version of this design kept draft photos device-local. That was
wrong, and the reason is worth recording: text on the laptop and photos on the
phone means the entry **can only be submitted from the phone**. That is not a
limitation, it is a puzzle the user has to solve — and they would solve it by
not bothering.

The fix is not to sync blobs. **Upload draft photos at attach time**, through
the encrypted media pipeline that already exists, and let the draft carry
`EntryPhoto` references. The draft stays small JSON; any device fetches and
decrypts.

That work is not added, it is **moved** — it has to happen on save anyway. Two
consequences, both good:

- Saving an entry gets faster; the "Securing photo 2 of 3…" stall at the moment
  of committing disappears.
- Uploading while someone is still writing is better than uploading while they
  are waiting.

The real cost is **orphans**: a photo attached to a draft that is then abandoned
must be deleted from Drive, and if that fails offline it needs a pending-cleanup
list. That is the part to build carefully.

## Coming back to it

Not a modal. Return to the capture screen and the fields are simply already
filled, with one line above them:

> *picking up where you left off · 2 hours ago · start fresh*

If the draft is more than a week old it becomes an **offer** rather than an
auto-fill, so an old fragment never ambushes a new thought.

A small dot on the 💭 button, or they would never know it was waiting.

## Maya's nudge

Not every unlock — that is nagging. On a **new session** (see
[sessions](./sessions.md)), at most **once a day**, only when the draft is more
than about **half an hour old**, and **never while they are already on the
capture screen**.

So it catches *"you left something unfinished yesterday"* and stays silent about
*"you put your phone down for a minute"*.
