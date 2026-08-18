# Access — the three mechanisms

All three are set during onboarding, in this order. The order is forced, not
stylistic: a passcode has to belong to *someone*, so identity must exist first.

| | Job | Where it lives |
|---|---|---|
| **Google** | The **door** — who may use this deployment, whose journal this is, and where the key is kept | Server-side session |
| **Passcode** | The **key to the journal** — it wraps the sync key | Nowhere. See below |
| **Biometric** | A **faster way to turn that key**, on this device only | Device-local, never synced |

Biometric is deliberately **not** a third factor. It is a shortcut for the
passcode, and the passcode always sits behind it — which is what makes it safe
to offer as optional and skippable.

## 1. Google is the door

Today the door is a single shared passcode (`APP_PASSCODE`, `middleware.ts`,
`lib/auth.ts`) with Google sign-in *behind* it. That inverts.

- `/welcome` is public. Everything else requires a session.
- The client already obtains a Google access token (`lib/drive.ts` →
  `getAccessToken`). It posts that once to **`/api/auth/session`**, which
  verifies it with Google, checks the allowlist, and sets a **signed, HttpOnly
  session cookie** carrying `{ sub, email, name }`.
- `middleware.ts` validates that cookie instead of the passcode. Every API route
  can now answer *"who is asking?"* — which is what makes per-person caps,
  per-person metering and device management possible at all.

**The allowlist lives in the Blob store** (`users/allowed.json`), editable from
the owner view. Not an env var: adding someone should be a tap, not a redeploy.

Someone not on the list gets a warm dead end, not a stack trace.

## 2. The passcode wraps the key

The sync key `K` (`lib/googleAccount.ts` → `ensureSecret`) currently sits in
Drive's `appDataFolder` **in plaintext**. Since Google is now also the door,
that makes the Google account a single point of failure for the whole journal.

So `K` is never stored directly. It is stored as **envelopes** — the same key
encrypted under different key-encryption-keys. Any envelope you can open yields
the same `K`.

```
biblio-sync.json  (Drive appDataFolder)
  v: 2
  wraps.pass      = encryptJSON({ secret: K }, passcode)
  wraps.recovery  = encryptJSON({ secret: K }, recoveryPhrase)
```

Both are the existing `EncryptedBlob` shape — `encryptJSON` / `decryptJSON` from
`lib/crypto.ts`, used unchanged. Almost no new cryptography.

Now you need **Google *and* the passcode**. Taking the Google account is no
longer enough.

### What falls out of this

**There is no server-side passcode store at all.** A wrong passcode fails as an
AES-GCM authentication failure, client-side, so correctness proves itself.
Nothing passcode-shaped — no hash, no salt, no env var — ever reaches a server.

The trade: attempt-limiting becomes client-side and therefore bypassable. At
this scale that is fine. PBKDF2 at 210,000 iterations is the real brake, and an
attacker would already need to be inside the Google account to try at all.

### Migration

Existing installs hold a v1 `{ secret }` file. On next sign-in we detect v1, ask
for a passcode, and write v2. No re-sync, no data movement.

**Write v2 alongside v1, never over it**, and delete the plaintext only after
unwrapping has been confirmed on a second device. This is the one irreversible
step in the plan — everything else can be fixed with another deploy, but a lost
`K` is a lost journal. See [cutovers](../releases.md#cutovers--when-the-door-itself-changes)
for the rest of the sequencing, including why the door change and the key change
must not ship together.

## 3. Forgetting the passcode

Three paths. All of them preserve the guarantee.

**They still have another device.** The common case, and not really a recovery
flow: that device already holds `K`, so Settings › Change passcode needs no old
passcode. Rewrap, upload, done.

**One device, but they saved the recovery phrase.** Enter it → unwrap → set a
new passcode → rewrap. A **fresh phrase is minted** at that moment, because the
old one has just been typed into a screen someone may have been watching.

**Neither.** The honest dead end — but note precisely what is lost: **cloud
recovery, not the journal.** Every device that still has biblio still has every
word, readable, and can export a backup. The sentence is *"this can't be
restored to a new phone"*, not *"your journal is gone"*.

### The door we must not build

A reset via Google or email. Whoever takes the Google account takes the mailbox,
and we would hand the journal straight back — the wrapping would have bought
nothing.

**Consequence, accepted deliberately: the deployment owner cannot recover a
user's journal.** No admin path, no override. This must be said during
onboarding, not discovered later.

### Making the dead end unlikely

Cryptography is not the lever here; the onboarding moment is.

- **Six words, not hex.** ~77 bits, PBKDF2-stretched. Easy to write on paper,
  easy to read aloud, no arguing about `0` versus `O`.
- **One deliberate act with it** — copy, share it to themselves, save it. An
  acknowledged step, not a wall to tap past.
- **Asked once more later.** If never confirmed, Maya raises it a few days in.
  Once, then never again.

## 4. Biometric

- Offered only where `PublicKeyCredential.isUserVerifyingPlatformAuthenticator
  Available()` returns true (`lib/biometric.ts`).
- Skipping costs nothing and does not nag.
- Re-offerable from Settings, and **offered fresh on every new device** — a
  credential on one phone is meaningless on another.
- Settings do not sync (`lib/sync.ts` carries entries, portraits, reflections
  and photos only), so `bioEnabled` / `bioCredId` are already correctly
  device-local. Keep it that way on purpose.

**Later, optional:** WebAuthn's `prf` extension can make the platform
authenticator a third envelope, so Face ID unwraps `K` directly and `K` never
rests in plaintext on the device. A clean reward for enrolling. Not phase 0 —
the already-unlocked-device path covers the same ground with no new API surface.

## What this does and does not protect

**Wrapping protects the cloud copy.** The on-device copy is protected by the app
lock and the operating system, not by this. `K` still sits in IndexedDB beside
the journal itself — which changes nothing, because the journal is there too.

The threat this closes is **Google-account compromise**, which was the one that
mattered.
