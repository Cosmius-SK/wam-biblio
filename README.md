# biblio — a living journal

Speak or type a raw, unfiltered thought. An AI rewrites it into a coherent entry
you'll actually want to reread, files it into a self‑organizing library, gives
significant moments a soft scene image, and lets you ask questions of your own
story over time — all in a calm, responsive PWA.

**Status: all four phases complete and live.** The app defaults to **$0** — every
AI feature has a free local "sample" preview, so nothing bills until you opt in.

## What it does

- **Capture** — speak or type a messy thought. (Dictation currently uses the
  browser's own speech service, which sends audio to the platform vendor;
  private on‑device transcription is planned — see
  [docs/user-management/onboarding.md](docs/user-management/onboarding.md).)
- **Shape** — Claude rewrites it into a coherent first‑person entry (you review &
  accept), and extracts mood, themes, and entities.
- **Self‑organize** — a Themes view groups your entries by mood/theme; a "state of
  you" Reflection summarizes where you are.
- **Ask your journal** — answers grounded only in your own entries.
- **Scenes** — significant entries get a soft, mood‑driven image, collected in a
  Gallery.
- **Keep it private & portable** — passcode gate, end‑to‑end encrypted backups,
  and live multi‑device sync where the server only ever sees ciphertext.

## Cost & privacy model (important)

- **$0 by default.** `AI_MODE` defaults to `sample`: Shape, Ask, Reflect and
  images all return free **local** previews — no Anthropic/Gemini calls.
- **One switch to go live.** A header toggle ("Sample · free" ⇄ "Live AI") flips
  to real models per‑device (a cookie the API routes read) — no redeploy.
  `AI_MODE=live` forces it globally.
- **Local‑first.** Entries live in your browser (IndexedDB). The AI routes are
  stateless and store nothing.
- **What can leave the device:** your raw entry text → Claude only (Anthropic
  does not train on API data). Only **sanitized scene prompts** (never raw text)
  ever reach Gemini. Encrypted snapshots → your own Vercel Blob store, ciphertext
  only. Your passphrase and plaintext never leave the browser.
- **Model throttle.** Most entries use Haiku 4.5 (`AI_MODEL_FLOOR`); the router
  escalates rich/long/significant ones to Sonnet 4.6 (`AI_MODEL_CEILING`), with an
  optional second pass. Live cost at journaling volume ≈ **$2–3/month**; images free.

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind + Framer Motion** — soothing,
  responsive, installable PWA.
- **Dexie / IndexedDB** — local‑first store (offline capture).
- **Anthropic SDK** — the "brain" behind the model throttle.
- **Web Crypto** — PBKDF2 → AES‑GCM for end‑to‑end encryption.
- **Vercel Blob** — optional ciphertext store for live sync.
- **Vercel Web Analytics + Speed Insights** — free on Hobby.

## Project structure

```
app/
  (journal)/page.tsx     Timeline (living reading view)
  capture/               Voice/text capture → shape → review → keep
  themes/                Self-organizing moods & themes + Reflect
  ask/                   Ask-your-journal
  gallery/               Wall of scene images
  vault/                 Encrypted backup/restore + cloud sync
  unlock/                Passcode screen
  api/
    structure|ask|synthesis   AI features (sample preview by default)
    image                     Gemini scene image (live only; dormant in sample)
    sync                      E2E-encrypted push/pull over Vercel Blob
    unlock                    Exchanges the passcode for an auth cookie
middleware.ts            Passcode gate over pages + spend-capable API routes
lib/
  db.ts                  Dexie schema + helpers
  ai/router.ts           Haiku↔Sonnet throttle + escalation
  ai/mode.ts             Sample vs live (env + per-device cookie)
  sample.ts              Free local previews for every AI feature
  scene.ts               Deterministic mood-driven scene generator
  crypto.ts              PBKDF2/AES-GCM encryption + sync id
  auth.ts                Passcode token helpers
```

## Getting started (local)

```bash
npm install
cp .env.example .env.local   # fill in what you need (all optional in sample mode)
npm run dev                  # http://localhost:3000
```

The app is fully usable with **no keys** in sample mode — tap **"Preview with
sample entries"** to explore. Use Chrome/Edge/Safari for voice capture.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | for Live AI | The journal's brain (shaping, ask, reflect). |
| `AI_MODEL_FLOOR` | no | Cheap default model (default `claude-haiku-4-5`). |
| `AI_MODEL_CEILING` | no | Escalation model (default `claude-sonnet-4-6`; can be `claude-opus-4-8`). |
| `AI_MODE` | no | Leave unset → the in‑app toggle decides (default sample, $0). `live` forces real models globally. |
| `GEMINI_API_KEY` | for live images | Free‑tier scene image generation (sanitized prompts only). |
| `APP_PASSCODE` | no | Set to lock the public URL. Unset → gate is off. |
| `BLOB_READ_WRITE_TOKEN` | for sync | Auto‑added when you connect a Vercel Blob store. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | for photos | OAuth Web client ID for Drive photo attachments (an identifier, not a secret). |
| `AUTH_SECRET` | for sign‑in | Signs the session cookie. Falls back to `APP_PASSCODE`; with neither, Google sign‑in is off. |
| `ALLOWED_USERS` | for sign‑in | Comma‑separated emails allowed in. Seeds the list; after that, manage it in the app. |
| `OWNER_EMAIL` | no | Always allowed in, exempt from personal caps, and the future owner‑only views. |
| `USER_DAILY_USD` | no | Per‑person daily AI spend cap (default `0.30`). `0` disables. |
| `USER_DAILY_IMAGES` | no | Per‑person daily illustrations (default `5`). `0` disables. |
| `GLOBAL_DAILY_USD` | no | Whole‑deployment daily breaker (default `2.00`). `0` disables. |
| `NEXT_PUBLIC_OWNER_NAME` | no | Who "Tell Maya" says messages go to. Defaults to a generic phrase. |

## Access gate — two doors

**Passcode.** Set `APP_PASSCODE` to require one. `middleware.ts` gates every page
and the spend‑capable API routes; visitors get the `/unlock` screen. The auth
cookie stores a derived token, not the passcode. Unset → no gate (fail‑open).

**Sign in with Google.** Set `AUTH_SECRET` and list at least one address in
`ALLOWED_USERS`, and `/welcome` offers a door that identifies *who* is asking —
which is what per‑person limits and a device list need. `/api/auth/session`
verifies the token with Google, checks the list, and sets a signed HttpOnly
cookie.

Both doors stay open. The passcode is not removed in the same release that adds
sign‑in: if the new door were broken in production, nobody could fix it from
inside an app the middleware is blocking. With no allowlist configured the
Google door stays shut, so turning it on is always deliberate. See
`docs/releases.md`, "Cutovers".

## Encrypted sync

The **vault** (footer → "Backup & restore") offers two paths, both end‑to‑end
encrypted with a passphrase that never leaves the browser:

- **File backup/restore** — download an encrypted `.biblio.json`; import it on
  another device. No backend, $0.
- **Live cloud sync** — Push/Pull via Vercel Blob. To enable: in Vercel create a
  **Blob** store → **Connect** it to the project (adds `BLOB_READ_WRITE_TOKEN`) →
  redeploy. The same passphrase on another device resolves the same encrypted
  slot. The server stores and returns only ciphertext.

## Photos on Google Drive

Entries can carry photo attachments. Each photo is **compressed and encrypted
on-device** (AES‑GCM with a per-journal media key), then uploaded to a
`biblio-journal` folder in **your own Google Drive** — Google only ever sees
ciphertext, and the `drive.file` scope means the app can only touch files it
created. A tiny local thumbnail keeps the timeline fast; tapping it fetches and
decrypts the original. The media key travels inside your encrypted backups and
cloud sync, so other devices can open the same photos after a Pull & merge.

One-time setup:

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project
   → **APIs & Services → Enable APIs** → enable the **Google Drive API**.
2. **OAuth consent screen**: External → fill the app name/email → **Publish** to
   production (the `drive.file` scope is non-sensitive; no verification needed).
3. **Credentials → Create credentials → OAuth client ID → Web application**;
   add your app origins (e.g. `https://your-app.vercel.app` and
   `http://localhost:3000`) under **Authorized JavaScript origins**.
4. Put the client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vercel env var) and
   redeploy, then tap **Connect Google Drive** in the vault.

## Deploy

Push to the repo and import it in Vercel (zero‑config Next.js). Set the env vars
you want in **Settings → Environment Variables** and redeploy. Web Analytics and
Speed Insights are wired in and free on Hobby.

## Using it for real

1. Tap **"Clear samples"** to remove the demo entries.
2. Flip the header toggle to **Live AI** and add a little Anthropic credit when you
   want genuine shaping/ask/reflect — or stay in free sample mode.
3. Connect a Vercel Blob store if you want phone↔laptop sync.
