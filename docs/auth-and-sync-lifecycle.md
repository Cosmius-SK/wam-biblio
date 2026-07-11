# Auth & Sync Lifecycle

A reference for how biblio authenticates the user, keeps sync working across
devices, and locks the app on-device. Status tags: **[built]** = shipped,
**[planned]** = Option B / biometric work not yet implemented.

## Two independent auth cycles

biblio deliberately keeps these separate — conflating them is the usual source
of confusion.

| | Account auth (Google OAuth) | App lock (biometric / passcode) |
|---|---|---|
| Gates | **Sync** — cloud copy + encryption key | **Opening the app** on this device |
| Mechanism | Google OAuth access token | WebAuthn platform authenticator; passcode fallback |
| Stored | Token in `localStorage`; key in Drive `appDataFolder` | Credential handle on-device |
| Expiry | Access token ~58 min; re-auth via Google | Per app-open / inactivity timeout |
| Needs network | Yes (Google + blob host) | No — fully local |

---

## Account auth (Google) — the sync key ownership

### Scopes
- `https://www.googleapis.com/auth/drive.file` — app-created media (photos, portraits). **[built]**
- `https://www.googleapis.com/auth/drive.appdata` — hidden app-only folder for the sync key. **[built]**
- `openid email profile` — identity (name/email/avatar) via the userinfo endpoint. **[built]**

### Token model (GIS token flow, no client secret) **[built]**
- Access token cached in `localStorage` as `{ t, exp }`, `exp = now + (expires_in - 120s)` (~58 min).
- Token is **authorization only** — it does not, by itself, prove identity. Identity comes from calling the userinfo endpoint with the token.
- The GIS token client can fire `callback`, `error_callback`, throw, or (on a
  silent refresh) go quiet. All four are handled behind a single settle guard
  plus an 8s silent-refresh timeout, so a token request **never hangs**.

### Lifecycle stages
1. **Enrollment (first sign-in)** — consent once → access token → read profile →
   generate a random **sync secret** → write it to `appDataFolder/biblio-sync.json`
   → cache secret locally. **[built]**
2. **Steady state** — token valid ~58 min; pull/push run silently with the cached
   token + cached secret (no Drive round-trip for the key).
3. **Token expiry → re-auth**
   - **Silent refresh** (`requestAccessToken({ prompt: '' })`) — works when a
     Google session exists.
   - **Interactive re-consent** — if silent fails (common in an installed PWA
     with no Google session), the next user-initiated Drive action shows the
     Google popup. Uploads try silent → interactive automatically. **[built]**
4. **New device** — sign in with the same account → read the secret back from
   `appDataFolder` → derive the same sync slot → **pull & merge**. **[built]**
5. **Sign-out** — clear local token, cached secret, stored profile. The Drive key
   file stays (so re-sign-in works); a "forget on this device" wipe removes the
   local copies.

### How the secret drives sync (reuses existing crypto) **[built]**
- `syncId(secret)` → the cloud slot locator (SHA-256 derived).
- `encryptJSON(payload, secret)` / `decryptJSON` → AES-GCM via PBKDF2.
- The **media key** rides inside the encrypted payload, so photos/portraits
  decrypt on other devices after a pull (`adoptMediaKey`).
- Net effect: the `appDataFolder` secret is an **auto-managed passphrase** — the
  entire tested sync pipeline is reused; Google just removes the "remember a
  passphrase" chore.

---

## App lock (biometric) — opening the app on this device **[planned]**

Independent of the network and of Google.

1. **Enroll** — `navigator.credentials.create()` registers a platform
   authenticator (Face ID / fingerprint); store only the credential handle
   locally.
2. **Unlock** — on app open and after an inactivity timeout,
   `navigator.credentials.get()` prompts the biometric. Success unlocks.
3. **Fallback** — if biometrics are unavailable or fail, fall back to the
   existing **passcode** gate. Biometric never becomes a lockout.
4. **Scope of protection** — with no backend (until Option C) this is a strong
   **device-bound local lock** (proves user-presence on the device), not a
   server-verified identity. That is the correct role for it.

---

## Passphrase path (retained, zero-knowledge) **[built]**

Untouched and parallel to Google sync. The manual passphrase never leaves the
device, so the ciphertext is unreadable by anyone without it — the max-privacy
option. Google sync is the effortless default; the passphrase is there whenever
fully private, no-Google-in-the-loop backup/sync is wanted.

---

## Privacy trade-off (chosen: Option B)

- **Passphrase sync** = *zero-knowledge*: key never leaves the device.
- **Google sync** = *convenient-private*: the key lives in your Drive
  `appDataFolder` (safe from the blob host, app-scoped in Drive, but reachable
  by Google). Accepted in exchange for effortless multi-device.

## Multi-user isolation (shared testing) **[built]**

Each Google account is naturally its own island — no server-side user table
needed:

- The sync **secret is per-account** (each account's own `appDataFolder`), so
  `syncId(secret)` resolves to a **different cloud slot** per user, and each
  payload is encrypted under a different key.
- Result: user B **cannot read** user A's journal, and vice versa. Everyone
  builds their own entries.
- The deployment owner sees only **ciphertext** blobs in the shared Vercel Blob
  store — unreadable without each user's secret.
- Photos go to **each user's own Drive** (`drive.file`).

Caveats to remember when sharing for testing:
- **AI cost is the owner's.** `/api/structure` (Claude) and `/api/image`
  (Gemini) use the deployment's keys, so testers' Live-AI actions spend the
  owner's credit.
- **Same browser profile = shared local data.** IndexedDB is per-origin, so two
  people on the *same* browser profile share the local journal. Isolation holds
  across *different* devices/browsers/profiles.
- **Consent screen access:** while in "Testing" status, each tester's Google
  email must be added as a Test user (or publish the app).

## Roadmap → Option C

When biblio becomes multi-user, a backend verifies Google ID tokens
server-side, stores user records + sessions, and **server-verified TOTP/2FA**
becomes meaningful (a server can hold and check the secret independently of the
device). Until then, strong account 2FA is simply enabling 2-Step Verification
on the Google account itself.
