# Devices and deletion

**Status:** the **registry is built** (`lib/users/devices.ts`,
Settings › Devices) — listing, renaming, disconnecting. **Deletion is not**:
none of the four radii below exist yet.

These are one topic. **Deletion is the same operation at four radii**, and the
radius only means something once devices are visible.

## The registry

Today there is no device concept at all. Each device silently holds its own copy
of the journal, its own cached key, its own biometric credential — and nothing
anywhere knows it exists. Fine for one person with one phone; not fine the
moment a phone is lost.

Each device mints a random `deviceId` on first run and registers under the
account — written at sign-in, touched on every sync:

```
users/<sub>/devices.json
  [{ id, label, platform, firstSeen, lastSeen }]
```

Labels auto-derived, **renameable** — "Chrome on Android" tells you nothing when
you own three.

Settings › Devices lists them with a last-seen time. That alone is the point:
**it is how you notice something is wrong at all.**

## The four radii

| | Scope | What it actually reaches |
|---|---|---|
| **Leave this device** | the one in your hand | wipes local; cloud untouched |
| **Disconnect a device** | one device, remotely | cuts off future sync; asks it to wipe when next seen |
| **Delete data** | everything that syncs | tombstones across all devices; account survives |
| **Delete everything** | the account | the above, plus key, Drive folder, records, grant |

**Delete data keeps the key.** Deleting it would silently break every other
device the person owns, which is not what "clear my journal" means to anyone.

**Export is offered first**, in all four. Not a hidden 30-day tombstone — that
quietly contradicts the privacy promise. Offering *"take your journal with you"*
catches the accidental case just as well and is honest about what happens next.

## Three things that are easy to get wrong

**A local wipe is not a wipe.** Clear the laptop and the phone will re-push
everything on its next sync and undo it. Deleting data must write **tombstones**
for every record — the mechanism already exists in `lib/sync.ts` — not merely
empty the tables.

**Signing out currently leaves the journal on the device.** `signOutGoogle()`
clears the profile, the key and the ledger, but every entry stays readable in
IndexedDB. On an old or borrowed phone that is a real hole. This is what
**"leave this device"** fixes, and it is probably the most-used of the four.

**Order matters when deleting everything.** Cloud blobs → Drive folder and the
`appDataFolder` key → local → revoke the OAuth grant. Delete the key first and
the ciphertext in the Blob store becomes both unreadable *and* unattributable:
permanent garbage that can never be cleaned up or explained.

## What remote disconnect actually is

**A request, not a command.** This has to be said in the interface.

A lost phone already holds the journal decrypted in IndexedDB with the key
cached beside it. If it is never opened again, or kept offline, nothing happens
— ever. We cut off future sync; we cannot reach back.

So:

- Call it **"Disconnect"**, never "remote wipe". Apple and Google can wipe
  because they own the operating system. We do not, and pretending otherwise
  would be the one dishonest thing in an app whose whole pitch is that it does
  not lie about privacy.
- **The phone's own lock screen is the real protection.** Said during
  onboarding, where it is actionable, alongside the biometric offer.
- **Do not rotate the key on a lost device.** It sounds right and achieves
  nothing — that device already holds `K` and everything synced to date.
  Revoking it at `/api/sync` protects future data at a fraction of the cost.

## Deletion works without the passcode

Erasing ciphertext does not require reading it. **You can always leave, even if
you cannot get in.** Build it that way deliberately.

## Report what could not be finished

"Delete everything" should say so: *"2 devices still hold a copy — they will
clear when next opened."* Better than a green tick that is not true.
