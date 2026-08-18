# Releases — and how we work from here

**Status: built.** `public/sw.js` (offline + a controlled update), the version
and build stamp in Settings › About, and the what's-new card fed from
`CHANGELOG.md` at build time. The discipline below — additive APIs,
forward-only migrations — is the standing part, not a task.

The ask: something like an app store. A version, a note about what changed, and
some say in when it arrives.

## The finding that prompted this

**biblio had no service worker.** `app/manifest.ts` existed, but nothing cached
anything and nothing held a version in place. Two consequences, neither of
which the app ever told anyone:

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

## Cutovers — when the door itself changes

The rule above protects **data** across versions. It does not protect **access**,
and that is a different failure mode with a much worse ending.

A lagging client is normally a safety net: the old build keeps working until it
updates. That net does not exist when the *gate* changes, because every client —
old and new — is behind the same middleware. Swap the passcode gate for the
session gate and get any part of it wrong, and nobody can get in, **including the
person who deployed it**, with no way to fix it from inside the app.

Four rules, and they are the same additive instinct applied to authentication
rather than to data:

**1. Never remove the old door in the deploy that adds the new one.** Accept the
session cookie *or* the passcode cookie. Ship. Confirm the new door works on
real devices. Remove the old path in a **later** release.

**2. Keep a break-glass path that is not the app.** If middleware is broken you
cannot fix it from a screen the middleware is blocking. `APP_PASSCODE` survives
as an owner-only override, checked last, for one release cycle beyond the
cutover. It costs nothing and it is the difference between redeploying a fix and
being locked out of your own production.

**3. Key migration is additive until proven.** Write the v2 envelopes
**alongside** the v1 `{ secret }`, never over it. Only delete the plaintext after
unwrapping has been confirmed on a second device.

This is the one genuinely irreversible step in the whole plan. Everything else
can be fixed with another deploy; **a lost `K` is a lost journal.** The local
cached copy in `googleSyncSecret` is the only other place it exists, and it is
not a backup.

**4. One cutover per release.** The door change and the key change ship
separately, each with its own verification. Individually both are recoverable.
Together they are a maze with no lights.

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
