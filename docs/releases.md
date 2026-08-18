# Releases — and how we work from here

The ask: something like an app store. A version, a note about what changed, and
some say in when it arrives.

## The finding

**biblio has no service worker.** `app/manifest.ts` exists, but nothing caches
anything and nothing holds a version in place. Two consequences, neither of
which the app has ever told anyone:

- **It does not work offline.** A local-first journal that cannot open on a
  plane or in a basement is a broken promise — and nobody will report it as a
  bug. They will quietly stop trusting it.
- **There is no update lifecycle to control**, because there is no version.

Both are the same fix. A service worker gets offline *and* the update mechanism
in one move.

## What is achievable, and what is not

**Achievable**

- a version stamp visible in Settings › About (`VERCEL_GIT_COMMIT_SHA` plus a
  human version)
- a **what's new** card shown once after an update, in Maya's voice
- **"a new version is ready — refresh when you're ready"** instead of a reload
  landing mid-sentence

That last one is why this and [drafts](./drafts.md) are the same conversation.
An update must never take words away.

**Not achievable**

Staying on an old version. There is one deployment and one API. A user can defer
a refresh for a while; they cannot decline it forever.

## The rule that actually changes how we build

Because clients lag, **there will always be mixed versions in the wild for a day
or two.** Therefore:

- **API changes are additive.** Never remove or repurpose a field an older
  client still sends or reads. Deprecate, ship, wait, then remove.
- **Dexie migrations are forward-only and non-destructive.** The schema version
  is a contract with devices that have not updated yet.
- **A new build must be able to read old records, and an old build must not
  choke on new ones.** Unknown fields are ignored, never fatal.

That discipline is the real work. The changelog is the easy part.

## Ways of working

**One source of truth.** A `CHANGELOG.md` at the repo root: version, date, and
the two or three lines a human would care about. The in-app what's-new card
reads from it. No second copy to drift.

**Version numbers people can hold.** Not commit hashes in the UI. A simple
incrementing version, with the commit stamp beside it for debugging.

**Every release answers three questions** before it ships:

1. Does an older client still work against this API?
2. Does this migration run cleanly on a database three versions old?
3. What does the what's-new card say, in Maya's voice, in one sentence?

**Staged rollout, informally.** Ship to the owner's own devices, use it for a
day, then let it reach everyone. At this size that is enough process.

## Not now

Android packaging and Play Store internal testing are **parked**. Web app for
the current round. If that changes, the service worker work done here is exactly
what a TWA would need anyway — nothing is wasted.
