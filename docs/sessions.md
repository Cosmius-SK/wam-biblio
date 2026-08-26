# Sessions

**Status: built.** The clock (`lib/session.ts`), the contextual presence check
with its answer chips (`lib/mayaLines.ts`, `components/MayaPresence.tsx`,
`components/Footer.tsx`), the growing interval, and the setting in
Settings › Maya. Still open: a `card` surface, since reading an entry has no
route of its own to detect.

One module, four consumers. `lib/session.ts` is the first thing to build — the
app lock, Maya's draft nudge, draft freshness and (later) insights all sit on
top of it.

## What a session is

A period of **attended use** — not tab-open time.

- **Starts** on load, or when the app becomes visible with no session open.
- **Accumulates** only while the document is visible.
- **Pauses** the instant it is hidden — tab switch, phone locked, backgrounded.
- **Ends** after 30 minutes continuously paused. Back sooner and it is the same
  session; back after lunch and it is a new one.
- **Discarded** under 10 seconds. That is navigation, not use.

## Presence is asked, not guessed

The hard case is someone **reading**. They are not typing, so gating on input
would erase reading time entirely — for this app, the wrong error.

Rather than infer, **ask**. After the idle interval, Maya appears and says
something. Answering keeps the session; silence ends it.

This is what makes the number trustworthy:

- **Answered → the idle span counts.** Presence was confirmed at the *end* of
  the interval, so the interval was attended.
- **Unanswered → the idle span is discarded.** The session ends at the last real
  interaction, and minutes nobody was there never enter the total.

The only uncertain minutes we ever count are the ones someone told us about.

### She says something contextual, not a template

This is what stops the check being an interruption. She is not running a
presence test with a suppression rule for the capture screen — she is saying
what a person would say, from where she is standing:

| Surface | Roughly |
|---|---|
| capture, with text | *"hope you're thinking deep…"* |
| home | *"hey <nickname>, it's a nice evening — worth a visit to your gallery"* |
| inside a card | *"that should be a great memory, isn't it"* |

Composed from parts — surface opener, daypart, nickname, optional nudge toward
another surface — with variant pools and no-repeat memory. Writing the
cross-product would produce hundreds of lines and she would still repeat
herself.

Each screen declares its surface (`capture` / `home` / `card` / `gallery` /
`book` / `settings`) so she knows where she is speaking from. That context is
worth having anyway, for everything else she does.

### Answering

**Contextual smileys, in her space** — not buttons, and not overlaid on the
journal, where a reaction row would read like a social feed and be tonally
wrong for something private.

The palette is **contextual, not emotional**. The test it has to pass: someone
is writing about a death and Maya appears with a row of happy faces. That must
be impossible. So `👀` / `👋` on the gallery; a word rather than a face on the
capture screen.

**Any interaction dismisses it** — a scroll, a keypress, a mouse move. Requiring
a specific tap would make it a challenge rather than a check.

Which smiley was tapped is **not recorded**. See
[privacy](./user-management/privacy.md#the-smiley-signal--built-dormant).

### The interval

Default **10 minutes** (5 is twitchy for anyone reading a long entry), settable
to 5 / 10 / 20 / 30 / never.

**It grows on confirmation** — 10, then 20, then 30. Someone who has said "still
here" twice is settled in with a long entry, and asking six times in an hour is
exactly how this becomes annoying.

`never` is a legitimate choice, offered with its trade named: *your journal
stays open until you close it yourself.*

### When silence wins

Session closes. Draft saved (already a no-op — it has been persisting all
along — but build it anyway; this is the one moment where losing words would be
unforgivable).

**Closing the session and locking are separate outcomes.** The session always
ends. Whether it locks is governed by the idle setting.

## Hidden is not idle

Two kinds of absence, two paths:

- **Hidden** → clock pauses instantly, relock on its own timer, silent. There is
  nobody to ask.
- **Visible but still** → Maya asks, then closes if unanswered.

Neither has to guess.

## Storage and hygiene

`sessions` table in Dexie: `{ id, startedAt, endedAt, activeMs, entriesWritten }`.
Numbers only. **Device-local, never synced** — same posture as the AI ledger.

**Clamp every increment.** Accumulate in small deltas and discard any single one
larger than the idle threshold. A laptop sleeping for six hours must not inject
six hours, and clock behaviour across suspend varies too much to reason about.
Clamping is correct regardless.

**Aggregate before anything leaves the device.** A raw session log is itself a
behavioural record — *opened at 2am, seven times* is exactly what the privacy
model says we do not want. Store the timeline locally; send only totals.

**A row is written when a session *ends*, and a session ends as the page is
being taken away.** Anything reading these rows to answer "what happened
today" must add the session in progress on top of them, or a person who opens
biblio once and closes it leaves no trace at all — and an empty Activity list
is indistinguishable from nobody having come. Two rules follow:

- Count the live session (`liveSession()`), not only the stored rows.
- Report *during* the visit — on arrival, on a few-minute heartbeat, the moment
  an entry is kept — and use `sendBeacon` on the way out. A phone switching
  apps freezes the document and kills an in-flight request with it.

**`entriesWritten` is the entry count**, not the journal. Counting the journal
counts entries that arrived by sync, so two devices report the same entry and
the owner's page adds them up.

## A caveat for later

Time spent is partly a function of who answers prompts — someone who habitually
ignores Maya will read as less engaged than they are. At two users that is
noise. Worth remembering before the number is ever used to judge whether the app
is working.
