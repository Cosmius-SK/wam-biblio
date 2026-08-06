# Short term — biblio for two or three close people

## Who this is for

Shiva's wife and brother. Real end users: **no idea how apps are built, and no
reason to care.** Every decision below bends toward that — nothing to configure,
nothing to remember, nothing to understand before the first sentence is written.

This is the whole design constraint. A tester who has to be *told* how to use it
has already told us something.

## Decisions taken

| | Decision |
|---|---|
| **Cost** | Shiva's API accounts, with a **hard daily cap per person** |
| **Login** | Their own Google accounts — no passcode, nothing to remember |
| **Privacy** | Metadata for insight, **never their words** |
| **Guiding** | A first-run walkthrough, with **Maya as the face** of it |
| **Listening** | A place to send thoughts back, **also Maya** |

---

## 1. Identity and access — Google sign-in becomes the door

Today the door is a shared passcode (`APP_PASSCODE`, `middleware.ts`,
`lib/auth.ts`) and Google sign-in sits *behind* it, only for sync. For two
non-technical people that's one secret too many, and it identifies nobody.

**Signing in with Google becomes the way in**, and the passcode retires.

- An **allowlist** of Google accounts (env: `ALLOWED_USERS="shiva@…,…,…"`).
  Adding or removing someone is one line and a redeploy.
- The client already gets a Google access token
  (`lib/drive.ts` → `getAccessToken`). It posts that once to
  **`/api/auth/session`**, which verifies it with Google, checks the allowlist,
  and sets a **signed, HttpOnly session cookie** carrying `{ sub, email, name }`.
- `middleware.ts` validates that cookie instead of the passcode. Every API route
  can now answer *"who is asking?"* — which is what makes per-person caps and
  per-person insights possible at all.
- Verifying once and trusting our own cookie (rather than calling Google on
  every request) keeps the AI routes fast.

Someone not on the list gets a warm dead end, not a stack trace: *"biblio isn't
open yet — ask Shiva."*

**Console note:** each of them must be a **Test user** on the OAuth consent
screen or Google blocks sign-in outright. They'll click past an "unverified app"
warning once. At two or three people this is a non-issue; the 100-user cap
belongs to the mid-term doc.

## 2. Cost — his accounts, capped per person per day

Measured rates (`lib/format.ts`): shaping ≈ **0.35¢** on Haiku, ≈ **1¢** on
Sonnet; Ask/Reflect ≈ **1¢**; **an illustration ≈ 4¢.**

**Images are 4–10× everything else — that is the lever.**

Two layers, because one of them must not depend on our own code being correct:

**Wallet backstops (no code, do first).** A separate Anthropic workspace + key
for this, with a **monthly spend limit**; and a Google Cloud **quota cap** on
Generative Language requests/day. Hard stops nothing can code around.

**Per-person caps (`lib/users/limits.ts`).** Counters in the Vercel Blob store
already connected — `meter/<date>/<sub>.json` → `{ calls, images, costUsd }`.
Checked before the model call, recorded after using the real token usage the
routes already return (reuse `estimateCost`). Wired into all four AI routes.

Suggested opening numbers — generous enough never to be felt:

| Limit | Value | Worst case |
|---|---|---|
| `USER_DAILY_USD` | 0.30 | ~$9/person/month |
| `USER_DAILY_IMAGES` | 5 | 20¢/day |
| `GLOBAL_DAILY_USD` | 2.00 | circuit breaker for the whole deployment |

Hitting a cap must never feel like a failure. It reuses the existing
`{ error, code, hint }` shape the UI already renders, in Maya's voice:
*"That's all the drawing I can do today — it comes back tomorrow."*

## 3. Privacy — the line, drawn precisely

**They own their words. Shiva owns the numbers.**

**Collected** (`lib/insights/`) — structural facts only:

- counts: entries, words *counted not stored*, photos, illustrations
- choices: which AI mode (deep / rephrase / none), timeline vs book, filter used
- rhythm: days active, time of day, session length, return on day 1 / 7 / 30
- surface: platform, browser, screen size, installed to home screen or not
- Maya: voice on or off, frequency, whether the tour was finished
- health: errors, with the screen they happened on
- cost: spend per person per day

**Never collected — not now, not "just for debugging":**

- entry text, titles, summaries, raw thoughts, photos
- questions asked of the journal, or any AI output
- **moods and themes** — these look like metadata but they are *derived from
  content*. "grief", "divorce", "quietly triumphant" would tell Shiva more
  about his wife's week than any paragraph. They stay out.

Two things make the promise real rather than stated:

1. **A page that shows them everything held about them** — Settings › Privacy,
   listing the actual collected record, with a button to stop collection.
2. **Their journal is end-to-end encrypted anyway.** Even the deployment owner
   sees only ciphertext (`lib/sync.ts`). The privacy promise is enforced by
   architecture, not goodwill — worth saying to them in exactly those words.

## 4. Maya shows them around

The single highest-value thing for two people who have never seen this app.
Maya narrates; nothing is a wall of text.

**Act 1 — Hello** (three or four full-screen cards): who she is, what biblio is
for, and the privacy promise in plain words.

**Act 2 — The room** (spotlight coach-marks on the real screen): the 💭 button,
the three tabs, filter and view, where settings live.

**Act 3 — The first sentence** (on the capture screen): what the three AI modes
mean, in her words, and then out of the way while they write.

Rules: skippable at any point, resumable where they left it, and repeatable from
Settings (*"Maya, show me around again"*). Progress in the local store, so it
never repeats itself uninvited.

**Her voice during the tour:** text first, with an invitation — *"I can read this
aloud, if you'd like."* Speech that starts unasked on someone's first minute is
startling, and iOS blocks it before a gesture anyway (`lib/maya.ts` → `prime`).

## 5. Maya listens back

A place for them to say how it's going — because these two will tell Shiva the
truth, and a Google Form would waste that.

- Maya asks **one gentle question at a time**, timed rather than nagging: after
  the first entry, after three days, after two weeks. *"Has anything felt
  awkward?"* — one question, a text box, send.
- Also reachable whenever they want: Settings › **Tell Maya**.
- The answer posts to `/api/feedback` → `feedback/<sub>/<timestamp>.json`.

**The boundary must be unmistakable.** The journal is never read; this is written
*to Shiva* deliberately. The screen says so in as many words, every time —
different colour, different framing, no ambiguity. Getting this wrong would
poison the trust that makes the rest work.

## 6. What Shiva sees

An owner-only view at `/insights`, gated to his own Google `sub`: who's active,
entries written, features used, retention, spend per person, errors, and the
feedback they've sent. Numbers and their volunteered words — nothing else,
because nothing else exists.

---

## Proposed structure

```
lib/users/
  session.ts        sign + verify the session cookie
  allowlist.ts      who may come in
  identity.ts       Google access token → verified profile
  limits.ts         per-person daily caps, counters in Blob
lib/insights/
  schema.ts         the exact shape collected — the privacy contract, in code
  collect.ts        client-side recording (numbers only)
app/api/auth/session/route.ts
app/api/insights/route.ts
app/api/feedback/route.ts
app/(owner)/insights/page.tsx
components/tour/
  Tour.tsx  Spotlight.tsx  steps.ts
components/MayaAsk.tsx      her feedback surface
app/settings/privacy/page.tsx
```

Reuses rather than rebuilds: `lib/maya.ts` (voice, presence, ducking),
`lib/mayaLines.ts` (her register), `lib/format.ts` → `estimateCost`,
`lib/blobStore.ts` (private/public-aware storage), the existing
`{ error, code, hint }` error contract.

## Build order

1. **Wallet backstops** and the Google console test users — no code.
2. **Session + allowlist**, retiring the passcode.
3. **Per-person caps** in the four AI routes.
4. **Insights + the privacy page** — the schema first, so the contract is
   written down before anything collects anything.
5. **Maya's tour.**
6. **Maya's feedback space** + the owner view.

Steps 1–3 are what must exist before anyone signs in. Steps 4–6 are what make
the round worth running.

## Verification

- A non-allowlisted Google account gets the warm dead end, not an error.
- Sign in as each of them: session cookie set, entries save, sync works.
- Set `USER_DAILY_USD=0.01`, shape twice — the second is refused, in Maya's
  voice, with the UI rendering the `hint`.
- Set `USER_DAILY_IMAGES=1`, illustrate twice — second refused.
- `meter/<date>/<sub>.json` matches Settings › AI › Usage.
- **Privacy audit:** write an entry with a distinctive word, then grep the whole
  insights store for it. It must not be there — nor its mood, nor its themes.
- Fresh account: the tour runs once, survives a reload mid-way, and does not
  return after finishing.
- Feedback from a tester's account appears in `/insights`, and `/insights` is a
  404 for anyone but Shiva.
