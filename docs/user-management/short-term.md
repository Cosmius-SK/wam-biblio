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
| **Login** | Their own Google accounts — identity that survives upgrades |
| **Passcode** | Kept, per person, set at first login — it **wraps the key** |
| **Biometric** | Offered as a choice during onboarding, per device |
| **Live AI** | **On by default** — so the disclosure moves into onboarding |
| **Privacy** | Two metrics only: entries written, time spent |
| **Guiding** | A first-run walkthrough, with **Maya as the face** of it |
| **Listening** | A place to send thoughts back, **also Maya** |

The detail lives in its own files, because these outgrew a section each:

- [**access.md**](./access.md) — Google, passcode, biometric; key wrapping; forgetting it
- [**onboarding.md**](./onboarding.md) — all of it stitched into one sequence
- [**privacy.md**](./privacy.md) — the line, drawn precisely
- [**devices-and-deletion.md**](./devices-and-deletion.md) — the registry, and the four radii

---

## 1. Identity and access

Google sign-in becomes the door; the shared `APP_PASSCODE` retires. The
**per-person passcode stays**, but with a different job — it wraps the sync key
rather than gating the server. Full design in [access.md](./access.md).

The **allowlist lives in the Blob store** (`users/allowed.json`), not an env
var. Adding someone is a tap in the owner view, not a redeploy. This matters
more than it sounds: env-var-per-person is hardcoding by another name, and it
scales to about nobody.

**Console note:** the OAuth app is **published (In production, External)**, so
there is no Test users list and nobody needs adding to one — any Google account
can reach the consent screen, and **biblio's own allowlist is the gate.** They
will click past an "unverified app" warning once.

Staying in production rather than reverting to Testing is deliberate: Testing
mode expires refresh tokens after seven days, which would make people re-consent
constantly. The cost is the **OAuth user cap** — while sensitive scopes are
unverified, the number of accounts that may ever grant consent is limited **over
the project's lifetime and cannot be reset**. Check the figure on the Audience
page and treat it as a budget, not a rate limit. Verification is what lifts it,
and it belongs in the mid-term doc.

## 2. Cost — his accounts, capped per person per day

Measured rates (`lib/format.ts`): shaping ≈ **0.35¢** on Haiku, ≈ **1¢** on
Sonnet; Ask/Reflect ≈ **1¢**; **an illustration ≈ 4¢.**

**Images are 4–10× everything else — that is the lever.**

Two layers, because one of them must not depend on our own code being correct:

**Wallet backstops (no code, do first).** A separate Anthropic workspace + key
with a **monthly spend limit**; and a Google Cloud **quota cap** on Generative
Language requests/day. Hard stops nothing can code around.

**Per-person caps (`lib/users/limits.ts`).** Counters in the Blob store —
`meter/<date>/<sub>.json` → `{ calls, images, costUsd }`. Checked before the
model call, recorded after using the real token usage the routes already return
(reuse `estimateCost`). Wired into all four AI routes.

**Agreed numbers** (built — `lib/users/limits.ts`, wired into all four AI routes):

| Limit | Value | Worst case |
|---|---|---|
| `USER_DAILY_USD` | 0.30 | ~$9/person/month |
| `USER_DAILY_IMAGES` | 5 | 20¢/day |
| `GLOBAL_DAILY_USD` | 2.00 | circuit breaker for the whole deployment |

Hitting a cap must never feel like a failure. It reuses the existing
`{ error, code, hint }` shape the UI already renders, in Maya's voice:
*"That's all the drawing I can do today — it comes back tomorrow."*

## 3. Server-side AI call logging

The current ledger (`ailog`, `lib/usage.ts`) is **client-side and records only
successes**. That is why the unexplained Gemini traffic — calls that 400'd and
never came back — has been invisible.

Log every outbound model call server-side, including failures:
`{ route, model, sub, status, tokens }`. It names that class of problem in one
look, and gives the per-person metering for free. Same work, much better return.

**Settle this before anyone is invited.** More users means more noise in exactly
the signal needed to find it.

## 4. Privacy

Two metrics: **entries written** and **time spent**. Everything else parked
until the group passes ten. Full model, including what is never collected and
the dormant smiley flag, in [privacy.md](./privacy.md).

## 5. Maya shows them around

See [onboarding.md](./onboarding.md) for the full sequence. Her character
definition — portable across projects — is [docs/maya/character.md](../maya/character.md).

## 6. Maya listens back

A place for them to say how it is going — because these two will tell Shiva the
truth, and a Google Form would waste that.

- Maya asks **one gentle question at a time**, timed rather than nagging: after
  the first entry, after three days, after two weeks.
- Also reachable whenever they want: Settings › **Tell Maya**.
- The answer posts to `/api/feedback` → `feedback/<sub>/<timestamp>.json`.

**The boundary must be unmistakable.** The journal is never read; this is
written *to Shiva* deliberately. The screen says so in as many words, every
time — different colour, different framing, no ambiguity.

## 7. What Shiva sees

An owner-only view at `/insights`, gated to his own Google `sub`: who is active,
entries written, time spent, spend per person, errors, and the feedback they
have sent. Numbers and their volunteered words — nothing else, because nothing
else exists.

---

## Foundations this rests on

Two app-wide systems are prerequisites, not extras:

- [**sessions.md**](../sessions.md) — the app lock, Maya's nudge and "time
  spent" all sit on one session module. Build it first; it is small.
- [**drafts.md**](../drafts.md) — draft persistence is a **prerequisite for the
  idle lock**. A lock that closes the app is only humane if nothing is lost.

And one that changes how every future release is built:

- [**releases.md**](../releases.md) — there is no service worker today, so no
  offline and no update control. Adding one gets both.

## Proposed structure

```
lib/users/
  session.ts        sign + verify the session cookie
  allowlist.ts      who may come in (Blob-backed)
  identity.ts       Google access token → verified profile
  limits.ts         per-person daily caps, counters in Blob
  devices.ts        the device registry
lib/session.ts      attended-use sessions (app-wide)
lib/drafts.ts       the single draft, persisted and synced
lib/insights/
  schema.ts         the exact shape collected — the privacy contract, in code
  collect.ts        client-side recording (numbers only)
app/api/auth/session/route.ts
app/api/insights/route.ts
app/api/feedback/route.ts
app/(owner)/insights/page.tsx
components/tour/    Tour.tsx  Spotlight.tsx  steps.ts
components/MayaAsk.tsx      her feedback surface
app/settings/privacy/page.tsx
app/settings/devices/page.tsx
```

Reuses rather than rebuilds: `lib/maya.ts`, `lib/mayaLines.ts`,
`lib/crypto.ts` (`encryptJSON`/`decryptJSON` carry the key wrapping unchanged),
`lib/format.ts` → `estimateCost`, `lib/blobStore.ts`, and the existing
`{ error, code, hint }` error contract.

## Build order

1. **Wallet backstops** and Google console test users — no code.
2. **Server-side AI logging**, and settle the Gemini traffic.
3. **`lib/session.ts`** — everything else leans on it.
4. **Drafts** — on top of sessions, and required before the lock.
5. **Session + allowlist + device registry**, retiring the shared passcode.
6. **Key wrapping v2** and the recovery phrase, with Shiva's own migration first.
7. **Per-person caps** in the four AI routes.
8. **Service worker**, version stamp, what's-new card.
9. **Insights + the privacy page** — schema first, so the contract is written
   down before anything collects anything.
10. **Maya's tour**, then her feedback space and the owner view.

Steps 1–7 are what must exist before anyone signs in. The rest is what makes the
round worth running.

## Verification

- A non-allowlisted Google account gets the warm dead end, not an error.
- Sign in as each of them: session cookie set, entries save, sync works.
- **Second device:** sign in, enter the same passcode, journal reassembles.
- **Forgot passcode:** change it from an unlocked device; and separately, from
  the recovery phrase alone on a fresh browser.
- Set `USER_DAILY_USD=0.01`, shape twice — the second is refused, in Maya's
  voice, with the UI rendering the `hint`.
- Set `USER_DAILY_IMAGES=1`, illustrate twice — second refused.
- `meter/<date>/<sub>.json` matches Settings › AI › Usage.
- **Draft:** type, background the app, force-quit, reopen — the words are there.
  Start on one device, finish on another. Attach a photo on the phone and see it
  on the laptop.
- **Idle:** Maya asks; answering keeps the session; silence closes it with the
  draft intact.
- **Privacy audit:** write an entry with a distinctive word, then grep the whole
  insights store for it. It must not be there — nor its mood, nor its themes,
  nor which smiley was tapped.
- **Deletion:** each of the four radii does what it says, and "delete
  everything" reports devices it could not reach.
- Fresh account: the tour runs once, survives a reload mid-way, and does not
  return after finishing.
- Feedback from a tester's account appears in `/insights`, and `/insights` is a
  404 for anyone but Shiva.
