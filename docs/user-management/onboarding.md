# Onboarding — the whole thing, in one line

**Status: mostly built.** Act 0 (`/welcome`), Act 1 (sign-in), Act 2 (passcode
and recovery phrase, in Settings › Security), Act 3 (biometric), Act 4 (Maya's
walkthrough — `components/tour/`), Act 6 and the install prompt.

**Act 5 — the private-voice choice — is deliberately absent** until on-device
transcription exists. Offering a choice we cannot yet honour would be worse
than not offering it.

Acts 2 and 3 are reached from the walkthrough by a link rather than performed
inside it, so there is one place those settings live and it is the place people
will look for them later.

Every access mechanism, every disclosure and every choice, stitched into one
sequence rather than six features standing next to each other. **Maya narrates
throughout.** Nothing is a wall of text.

The shape of the order: **identity → key → this device → understanding →
capability → the first sentence.** Each step asks only for what the previous
step made possible, and nothing is requested before the user has a reason to
grant it.

---

## Act 0 — Arrival (public)

`/welcome`, reachable without a session — the only page that is.

Three lines about what biblio is, and one button: **Continue with Google**.

Someone not on the allowlist gets a warm dead end here, in Maya's voice, not a
stack trace. *"biblio isn't open yet — ask Shiva."*

## Act 1 — Who you are

1. **Google sign-in.** One consent covers identity, Drive (photos) and
   `appDataFolder` (the key). They will click past an "unverified app" warning
   once, until the project is verified. Nobody needs adding to a Test users
   list — the app is published, and biblio's allowlist is what decides.
2. The token posts to `/api/auth/session`; the allowlist is checked; the session
   cookie is set. From here on the server knows who is asking.
3. **Maya asks what to call them.** A nickname, not a form field — it is the
   first thing she says, and it is used everywhere after.

## Act 2 — Your key

4. **Set a passcode.** Framed for what it is: *this is what locks your journal,
   and it is the reason nobody else can open it — including the person who
   built this.*
5. **The recovery phrase.** Six words, shown once, with **one deliberate act to
   save it** — copy, or share it to themselves. Not a wall to tap past.
6. **The honest sentence, said plainly:** if both the passcode and the phrase are
   lost, nobody can recover the journal for them. This is the moment to say it.
   Discovering it later would be a betrayal.

## Act 3 — This device

7. **Biometric, offered as a choice.** Only where the device supports it.
   Skipping costs nothing and is never raised again unasked.
8. Alongside it, the thing that is actually true and worth saying: **the phone's
   own lock screen is the real protection.** biblio can cut a lost device off
   from future sync, but it cannot reach back and erase what is already on it.
   That honesty belongs here, where it is actionable.

## Act 4 — Maya, and the room

9. **Who she is.** Brief. She is already speaking, so this is mostly an
   introduction to what she will and won't do.
10. **The privacy promise, in plain words:**
    - the journal is end-to-end encrypted; the owner sees ciphertext only
    - what is collected is counts — entries written, time spent — and nothing else
    - what is never collected: their words, their photos, their questions, their
      moods and themes
    - **Live AI is on**, which means their words travel to Anthropic through the
      owner's API key. He cannot read them; they still transit his account. This
      must be stated, not buried in Settings.
    - photos go to **their own** Google Drive — their storage, invisible to him
11. **The room** — spotlight coach-marks on the real screen: the 💭 button, the
    three tabs, filter and view, where Settings live.

## Act 5 — Voice

12. **Show, then ask.** Maya demonstrates quick voice first, with live partial
    transcripts, so the choice is made against something real rather than a
    description. Then she explains that the audio travelled to Google.
13. **The choice: Keep it private · Keep it quick · Decide later.**
    - private → the on-device model downloads in the background during the rest
      of the tour, Wi-Fi aware; nothing downloads unless chosen
    - decide later → re-offered at the next use of the microphone, not nagged
14. A *"say that again?"* confirmation once the private path is ready.

## Act 6 — The first sentence

15. **The three AI modes**, in her words — deeper touch, just rephrase, no AI.
16. **Then out of the way.** The tour ends by leaving them on a blank page with
    the cursor in it.

## One last thing

**Install to the home screen.** On iPhone this is not discoverable, and it is
the single most likely reason someone never really uses the app. Shown once, at
the end, when they have a reason to want it.

---

## Rules that apply throughout

- **Skippable** at any point.
- **Resumable** exactly where they left it — progress in the local store.
- **Repeatable** from Settings: *"Maya, show me around again."*
- **Never repeats itself uninvited** once finished.
- **Her voice is offered, not taken.** Text first, with an invitation —
  *"I can read this aloud, if you'd like."* Speech starting unasked in someone's
  first minute is startling, and iOS blocks it before a gesture anyway
  (`lib/maya.ts` → `prime`).
- **No presence check during onboarding.** Asking someone whether they are still
  there, two minutes into their first use, would be absurd.

## The second device

Not the same journey. Someone signing in on a laptop having set up on a phone
gets the short form:

**Google → enter the existing passcode → biometric offered → sync reassembles
the journal.** No tour, no privacy walkthrough, no voice choice — those belong
to the person, not the device, and they have already been made.

The one new thing on a second device is the biometric offer, because a
credential is per-device by definition.

## What has to exist for this to run

| Step | Depends on |
|---|---|
| Act 0–1 | `/api/auth/session`, allowlist in Blob, session cookie, middleware inverted |
| Act 2 | key wrapping v2, recovery phrase generation |
| Act 3 | `lib/biometric.ts` (exists), device registry |
| Act 4 | Maya's tour component, insights schema written down first |
| Act 5 | on-device voice model, hosted |
| Act 6 | nothing new |

Steps in Acts 0–2 are what must exist before anyone signs in. The rest is what
makes the round worth running.
