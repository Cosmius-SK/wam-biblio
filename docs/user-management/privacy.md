# Privacy — the line, drawn precisely

> **Numbers and settings, never words.**

They own their words. The owner owns the counts. Everything below follows from
that, and where a privacy choice would cost someone experience, **the choice is
surfaced to them rather than made for them.**

## What is collected

For the closed group, deliberately cut to almost nothing:

| | |
|---|---|
| **Entries written** | a count |
| **Time spent** | session duration, measured honestly (see [sessions](../sessions.md)) |

That is the whole list. Everything else — feature usage, retention curves,
platform breakdowns, error rates — is **parked until the group passes ten
people**. At two or three, insight comes from asking them, and instrumentation
is a poor substitute for a conversation.

Cost per person per day is metered separately (`meter/<date>/<sub>.json`)
because it protects the wallet, not because it is interesting.

## What is never collected

Not now, not "just for debugging":

- entry text, titles, summaries, raw thoughts, photos
- questions asked of the journal, or any AI output
- **moods and themes** — these look like metadata but are *derived from
  content*. "grief", "divorce", "quietly triumphant" would say more about
  someone's week than a paragraph would. They stay out.

## The smiley signal — built, dormant

The presence check (see [sessions](../sessions.md)) is answered by tapping a
contextual smiley. It would be easy to record which one, and tempting to call it
insight.

**It is not recorded.** The collection point exists in code behind a flag that
is **off for this release**, and the flag is checked **at the recording site,
not at the upload site** — so nothing is written, not merely nothing sent. That
distinction is the whole promise.

Two rules govern turning it on:

1. It requires its own disclosure at that time.
2. **It starts from then.** No sweeping up a back-catalogue accumulated while
   users had no idea it was being kept.

Two things were considered and rejected:

- **Smileys as a mood rating.** The tap answers *"are you still there?"* — the
  dominant motive is dismissing the prompt, not expressing a feeling. Treating
  it as sentiment repurposes an answer given for a different reason.
- **Mood-driven theming.** Beyond the poor signal, an interface that dims when
  someone taps the sad face amplifies a low mood back at them. A journal reached
  for on the worst days should be **a steady room, not a mirror.** Where
  emotional attunement is wanted, `entry.mood` already exists per entry, derived
  from what they actually wrote, and never leaves the device.

## Choices surfaced, not decided

Where privacy and experience genuinely trade off, the user picks:

| Choice | The trade, stated plainly |
|---|---|
| **Voice** — private / quick / decide later | on-device transcription costs a download and some speed; quick sends audio to Google |
| **Idle timeout** — including "never" | *"your journal stays open until you close it yourself"* |
| **Live AI** | on by default; their words travel to Anthropic through the owner's key |

## Live AI is on by default — so the disclosure moves forward

Sample mode as a first impression undersells the app, so Live AI ships on. The
consequence is that **their words reach Anthropic before they have made any
choice about it**, which moves the disclosure out of Settings and into Act 4 of
[onboarding](./onboarding.md), spoken by Maya.

The owner cannot read their entries — the routes are stateless and sync is
ciphertext — but the words transit his API account. Say so.

## What makes the promise real rather than stated

1. **A page that shows them everything held about them** — Settings › Privacy,
   listing the actual collected record, with a switch to stop collection.
2. **The journal is end-to-end encrypted anyway.** Even the deployment owner
   sees only ciphertext (`lib/sync.ts`). **The promise is enforced by
   architecture, not goodwill** — worth saying to them in exactly those words.
3. **Photos live in their own Drive**, under `drive.file`, invisible to the
   owner and counted against their storage, not his.
4. **They can leave completely** — see
   [devices and deletion](./devices-and-deletion.md).

## Maya's feedback space is the exception, and it must look like one

One place exists where a person deliberately writes **to** the owner: Maya's
feedback space. That is a different act from journalling, and the interface has
to say so — different colour, different framing, every time, no ambiguity.

Getting this boundary wrong would poison the trust the rest of it rests on.

## Verification

- Write an entry containing a distinctive word, then grep the entire insights
  store for it. It must not be there — nor its mood, nor its themes.
- Tap every smiley in a presence check, then inspect local storage: no record of
  which one.
- Settings › Privacy shows the real record, not a description of it.
