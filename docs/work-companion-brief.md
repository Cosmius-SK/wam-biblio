# A work companion, on biblio's foundations — handoff brief

**Written for a fresh conversation that has never seen biblio.** Paste it in
whole. It carries three things: what the product is, what it can take from
biblio and take literally, and the platform lessons that cost real time here
and would cost them again.

Nothing in this document is settled. The section **Decisions for the founder**
at the end lists what only Shiva can answer, and the rest is written as a
recommendation, not a plan of record.

---

## 1. The product, in a paragraph

A personal AI partner for corporate work. It sits beside one person through
their working day, takes the mess — a spoken thought after a meeting, a page of
notes, a half-formed argument — and turns it into the artefact their job
actually requires: a note, a document, a deck, a workflow, a summary with a
recommendation. It is not a chatbot and not a wiki. It is the thing that
removes the mundane half of knowledge work so the person spends their attention
on the strategic half.

Its sibling, **biblio**, does the same for a personal life: capture a thought
before it evaporates, and give it back shaped. Same reflex, entirely different
output.

---

## 2. The honest market read, before anything is built

"AI that helps you with work documents" is the most crowded space in software.
Microsoft Copilot, Notion AI, Gemini for Workspace, Glean and thirty startups
are already there, most of them attached to the data. Competing on "it writes
your documents" loses.

**The wedge is not the writing. It is that the output is already yours.**

A generic model writes generic documents. What it cannot do — and what every
one of those tools is worst at — is produce something you can send without
rewriting it: your company's deck template, your team's vocabulary, your
client's name spelled the way your firm spells it, the approval line your
organisation expects, the tone your director reads without wincing.

That is not a prompt. It is a **model of the organisation**, held by the
product and consulted on every generation. Which is exactly the thing biblio
already proved out at small scale — see the next section.

---

## 3. The spine: an organisation model

biblio's most important feature is not its illustrations. It is **Your world**:
a small local store of the people, places and things a person keeps writing
about. When an entry mentions someone the journal knows, their *description* —
never their name — is injected into the image prompt, so the same family looks
like the same family in every picture.

The general principle, and the one to carry over:

> **The world model is the feature. Generation is one consumer of it.**

For work, "your world" becomes **your organisation**:

| biblio holds | The work companion holds |
|---|---|
| People (a face, chosen once) | Stakeholders — role, seniority, what they care about, how they like to be written to |
| Places (a few words) | Clients, accounts, systems, products |
| Things (a detail or two) | Terminology, acronyms, the words your firm uses and the ones it avoids |
| — | **Brand**: logo, palette, type, deck and document templates |
| — | **Formats**: what a "status update", a "one-pager", a "steerco pack" looks like *here* |

Every artefact the product makes is generated against that model. That is the
whole product in one sentence, and it is defensible in a way "we call an LLM"
is not.

**Learn from biblio's mistake here:** the cast was built as a settings page
first, and a settings page is a page nobody visits. It only worked once the
offer was made *at the moment it explained itself* — right after a generic
result, when the person had just seen why it mattered. Build the organisation
model the same way: never a setup wizard, always an offer attached to a
disappointing output.

---

## 4. What it inherits from biblio — principles

These were expensive to arrive at. They are not style preferences.

1. **Capture must be instant and offline.** The whole reason the product exists
   is thoughts that vaporise. Anything between the impulse and the text is a
   design failure. Local-first storage, sync afterwards.
2. **Choosing terminates; correcting does not.** Regenerating an AI output is a
   dice roll — the parts that were right are lost with the part that was wrong.
   Wherever possible, let the person *choose from structure* rather than
   *correct a result in adjectives*. (biblio's avatar builder exists entirely
   because of this. It applies just as hard to a deck layout or a document
   tone.)
3. **Structure as data, rendered locally.** Never ask an image model for
   something with text in it. A mind map, a workflow, an org chart, a timeline
   — have the model emit a small JSON structure and render it yourself. Real
   text, legible, free after the first call, offline, restyleable, consistent
   with the rest of the app. This is the single highest-leverage decision in
   the product.
4. **Silence is a valid output.** biblio's companion, Maya, mostly says
   nothing. A work assistant that comments on everything is one people turn
   off in week two.
5. **Nothing invented.** Summaries, entities and structure must be faithful to
   what the person actually wrote. A work tool that quietly embellishes is
   worse than no tool: it will be sent to a client.
6. **Updates never happen underneath someone.** The service worker deliberately
   does not `skipWaiting()`; it waits, says a new version is ready, and the
   person chooses — after their draft has been flushed.
7. **The changelog is the single source of release notes.** Written before
   shipping, parsed at build time, split into audiences. No second copy to
   drift.

---

## 5. What it inherits from biblio — code

biblio is Next.js (App Router) + TypeScript + Tailwind + Framer Motion +
Dexie/IndexedDB, deployed on Vercel, with Anthropic for text and Gemini for
images. These pieces are worth taking almost as they are:

| Piece | What it does | Why it is worth taking |
|---|---|---|
| `lib/crypto.ts`, `lib/keyvault.ts` | PBKDF2 → AES-GCM; key wrapping via envelopes (same key sealed under a passcode *and* a recovery phrase) | Solved problem, including "forgot the passcode" without a backdoor |
| `lib/sync.ts`, `lib/syncKeys.ts` | Differential sync: per-record encrypted blobs, content-hash ledger, tombstones | Two devices converge without a server that can read anything |
| `lib/drafts.ts` | Debounced local save, pre-encrypted `sendBeacon` push | A phone freezing mid-sentence does not lose words |
| `lib/session.ts` | Attended-use sessions: clock runs only while visible, clamped, idle-credited | Honest usage measurement, not tab-open time |
| `lib/insights/` | Two numbers a day per device, absolute totals, schema file as the privacy contract | A telemetry design that survives being read by the people measured |
| `lib/users/` | HMAC session cookie (Edge-safe), allowlist, invite links, device registry, per-user daily caps | A complete small-scale access system |
| `lib/ai/structurePrompt.ts` | Messy input → structured JSON (title, summary, entities, …) | The core shaping pass; the work version changes the schema, not the mechanism |
| `lib/transcribe.ts` | Web Speech dictation, correctly (see lesson 1 below) | Do not rewrite this from an example; the examples are wrong |
| `lib/world/` | The world model + deterministic local rendering from structured choices | The pattern the organisation model should follow |
| `next.config.mjs` | Version + release notes read from `CHANGELOG.md` at build time | Small, and it removes a whole class of drift |

**Do not take:** Maya's character and copy (a different product needs a
different register), the illustration pipeline (work output is diagrams and
documents, not watercolour), and the mood/significance fields (meaningless at
work, and forcing them adds noise).

---

## 6. What must be architecturally different

This is where the sibling stops being a fork. Four forks, in order of how much
they change:

### Fork 1 — End-to-end encryption versus collaboration

biblio holds a hard line: the server can never read anything. Ciphertext only,
key on the device, wrapped under a passcode. That line is what makes it
trustworthy with a private diary.

**You cannot keep that line and also have** shared documents, team libraries,
admin retention, eDiscovery, or "my colleague picks up where I left off". Those
require the server to see content.

The decision is not all-or-nothing, and the useful shape is per data class:

- **Private thinking** (raw capture, half-formed notes) — end-to-end encrypted,
  same as biblio. This is the part people will not use the product for unless
  it is genuinely private.
- **Shared artefacts** (the finished deck, the sent document) — server-side,
  permissioned, auditable, exportable.

Deciding this *late* is expensive. Decide it first.

### Fork 2 — One person versus an organisation

biblio has one user, one journal, one key. A work product needs tenants, teams,
roles, SSO (Google Workspace and Entra at minimum), an admin console, seat
management, and an audit trail. None of biblio's `lib/users/` survives contact
with that — it is a good small-scale allowlist, not identity infrastructure.
Plan for an identity provider (WorkOS, Auth0, Clerk) rather than growing the
allowlist.

### Fork 3 — Output leaves the building

biblio has deliberately never had sharing. The work companion is defined by
what it hands over: `.docx`, `.pptx`, `.pdf`, a link, a Slack message, a Jira
comment. That means real export fidelity (not markdown-to-HTML-to-print) and
integrations from day one. Budget for it; it is not a feature, it is the point.

### Fork 4 — Compliance is a product requirement

SOC 2, GDPR, data residency, retention policies, DPA, subprocessor list, and a
straight answer to "does our data train your models". Enterprise buyers ask on
the first call. biblio never needed any of it.

---

## 7. What it actually produces

Artefacts, not chat. Each one is a template plus the organisation model plus
the person's raw input:

- **A working note** — the mess, cleaned: the points, the open questions, the
  one next step. Cheap, text-only, the everyday case.
- **A diagram** — mind map, workflow, sequence, org chart, timeline. *Emitted
  as structured JSON by the model and drawn by the product*, never generated as
  an image.
- **A document** — one-pager, brief, status update, proposal, in the
  organisation's template and voice.
- **A deck** — the hardest and the most valuable. Structure first (the argument
  as a tree), then layout, then the brand template.
- **A critique** — "here is what a reviewer will ask about this". The
  "strategic improvisation" Shiva named. Often more valuable than generation,
  and much cheaper.

**One line that must be held:** the product notices commitments; it does not
manage them. The moment it holds deadlines and done-states it becomes a task
manager, inherits reminders, overdue, snoozing and sync-with-Jira, and stops
being what it is. Surfacing *"three weeks ago you said you'd have this by
Friday"* is the journal being useful. A checkbox is a different product.

---

## 8. Roles

The origin of this idea was a request for *personas* — the same person writing
a diary and preparing a work presentation. In a dedicated work product,
personas become **roles**, and they are a seeding mechanism rather than a mode:
a consultant, a product manager, an engineer, an account executive each start
with different templates, vocabulary and default artefacts. The person picks
one on day one, and the organisation model diverges from there through use.

Roles seed. Use adapts. Never a mode you have to remember you are in.

---

## 9. The companion's character

biblio has Maya: a presence, not a mascot. No face, a voice, and a rule that
she mostly says nothing. The work companion needs its own character and it must
be **quieter and more practical** — the same restraint, a lower register.
Specifically:

- Never comments on quality unasked.
- Never celebrates.
- Interrupts only with something a person would thank a colleague for saying.
- Has an off switch that genuinely turns it off.

Whatever else is copied from biblio, copy that discipline. It is the reason the
product will still be open in month three.

---

## 10. Platform lessons — read this before writing a line

Every one of these was found the hard way in biblio, in production, usually on
a phone.

1. **Web Speech: rebuild, never accumulate.** The obvious loop — walk from
   `event.resultIndex`, append anything `isFinal` to a running string — is what
   every example shows and it is wrong on Android: the same result is delivered
   final more than once and `resultIndex` does not reliably advance. A tester's
   first voice note came back as the same sentence eight times, each copy a word
   longer. Rebuild the transcript from `event.results` on every event; it is
   idempotent. Also: Android ends the session at every pause even with
   `continuous`, so restart until the speaker stops; and set the language from
   the device rather than hardcoding `en-US` (accuracy on Indian and British
   English is materially worse when the engine expects American).
2. **Do not build voice capture on the browser's speech API. biblio tried and
   removed it.** What a browser hands a website is a small, low-latency engine
   that commits each word as it is spoken with almost no lookahead: no
   punctuation, names replaced by the nearest word it knows, and "going to
   help" settled as "going to hell" before the rest of the sentence can argue.
   A week went into making it behave — result redelivery on Android, sentence
   boundaries from pause timing and then from the engine's own capital letters,
   restarts across pauses, a singleton so two recognisers could not fight over
   one microphone — and none of it closed the gap. Two answers, and a work
   product needs both:
   - **Point at the dictation already on the device.** The mic key on a phone
     keyboard, `Windows + H`, the mic key on a Mac. It hears a whole sentence
     before deciding any word in it, punctuates natively, and is free. Say
     which key; do not offer a worse button beside it, because the easier path
     is the one people take and then judge the product by.
   - **For anything you control, use real ASR** (Whisper/Deepgram-class, about
     half a cent a minute). A demo's first minute is somebody talking to it,
     and this is the cheapest quality you will ever buy.
   What no engine of any size fixes is a name it has never heard — a colleague,
   a client, a product. Correct those from a list you already hold (see the
   organisation model), matching only *capitalised* near-misses, because an
   engine returns a name capitalised even when it gets it wrong, and that
   capital is what makes the correction safe to do automatically.
3. **Google's browser OAuth token lasts about an hour and has no refresh
   token.** A silent refresh (`prompt: ""`) works only where the browser still
   has a Google session, which an installed PWA on iOS usually does not.
   Otherwise it needs a popup, and a popup needs *transient user activation*.
   Two traps: returning to the foreground grants no activation, and **WebAuthn
   consumes activation rather than issuing any** — so a fingerprint cannot buy
   you a popup. Renew early and silently; where you cannot, spend a tap the
   person is already making (biblio uses the unlock tap, before the biometric).
   Pass the account `hint` so the window opens and closes itself.
4. **A phone freezes the page when you switch apps, and an in-flight `fetch`
   dies with it.** Anything that must survive leaving — a draft, a metric —
   goes via `sendBeacon`, computed *before* the moment, because an `await` on
   the way out is a bet the page will still be running.
5. **Never report only at the end of a session.** biblio's usage numbers were
   computed from finished sessions, and a session finishes as the page closes.
   Result: testers who visited and wrote looked like testers who never came.
   Report on arrival, on a heartbeat, and at the moment something is created.
6. **Sync: hash what is on disk, not what arrived.** Recording the incoming
   record's hash after a merge left the two sides permanently disagreeing, and
   the text grew on every pass. Also: keep the list of record types in **one**
   file — it has been wrong in two separate files here, and sync fails silently,
   so a mismatch does not error anywhere; it just means something a person
   wrote never arrives.
7. **Newest-wins beats clever merging.** A concatenating merge for conflicting
   drafts never converged: each side saw the other's join as a new conflict.
   Newest wins is what every notes app does and nobody is surprised by it.
8. **Corporate proxies return HTML on a 403.** A Zscaler block page is
   indistinguishable from a permission refusal unless you check the body. Detect
   it and say "your network blocked this" rather than "you denied access" — that
   one cost a day of chasing the wrong bug.
9. **Fail closed on allowlists, fail open on gates that can lock you out.**
10. **Provider wallet limits are the real ceiling.** Application-level caps exist
   so nobody ever *reaches* the provider's; the provider's spend limit is what
   makes a runaway cost cents instead of a weekend.
11. **A fix nobody can install is not a fix.** A browser looks for a new service
    worker on navigation and then roughly once a day; refreshing does not force
    it. A build shipped ten minutes ago can stay invisible however many times
    somebody reloads — indistinguishable, from the outside, from a fix that was
    never made. Call `registration.update()` on arrival and on returning to the
    tab. Two of biblio's bug reports were this.
12. **Count the marginal cost before removing a model call.** biblio's owner was
    ready to build a local model to avoid "paying for sentence correction". The
    correction was 190 tokens on a call that already happened: 0.019¢ per
    entry, against a 350MB download that would not run on the test phone. Work
    out the actual arithmetic before architecting around a cost.
13. **Cost shape:** text shaping is roughly a tenth the cost of image
    generation. A product built on structured text and locally rendered
    diagrams is dramatically cheaper to run than one that generates pictures.

---

## 11. A staged plan

**Stage 0 — Decide the forks.** Section 6. Especially fork 1; everything else
is downstream of it.

**Stage 1 — Capture and shape.** Voice and text in, structured working note
out. Offline, instant, syncing. This is biblio's spine and it already works.

**Stage 2 — The organisation model.** Stakeholders, clients, terminology,
brand. Built by offers at the moment of a disappointing output, never a wizard.

**Stage 3 — One artefact, end to end.** Pick the narrowest valuable one — a
status update or a one-pager — and take it all the way to a file a person sends
without editing. Depth over breadth: one artefact that is genuinely finished
beats five that need rewriting.

**Stage 4 — Diagrams.** Structured JSON, locally rendered. Mind map first.

**Stage 5 — Decks.** Argument tree → layout → brand template. The hardest, and
the one that sells the product.

**Stage 6 — Team.** Sharing, permissions, admin. Only after a single person
would pay for it alone.

---

## 12. The first day

Ordered so that each step is usable before the next begins, and so that the two
decisions that are expensive to reverse are taken before anything depends on
them.

1. **Stand up capture.** One screen: a box that saves as you type, and one
   button. Local-first, so it works offline and survives a closed tab. No
   login, no folders, no formatting, no title field. Anything between having a
   thought and the thought being in the box is the enemy, and everything else
   on this list can wait.
2. **One model call, returning structure.** Not a chat — one pass over the
   mess, returning fixed fields rather than prose:

   | Field | What it holds |
   |---|---|
   | `title` | short, from their own words |
   | `points` | what they actually said, tidied, as separate points |
   | `questions` | what the note leaves open |
   | `next` | the single next step, or nothing |
   | `mentions` | people, clients, projects, systems named |
   | `kind` | which artefact this wants to become, if any |

   Fields rather than prose because everything downstream — the document, the
   deck, the diagram — is built from them. Prose is a dead end: you cannot lay
   out a paragraph. biblio's `lib/ai/structurePrompt.ts` and `lib/ai/client.ts`
   transfer nearly unchanged and the schema is the only real edit. About a
   quarter of a cent per note on the cheap model.
3. **One artefact, end to end.** The narrowest valuable one — a status update
   or a one-pager. Take it all the way to something a person would send without
   editing. If it needs editing, the product does not exist yet, and no amount
   of breadth fixes that.
4. **The organisation model, seeded by one offer.** Not a wizard: the first
   time an artefact comes out generic, ask for the one thing that would have
   fixed it. That is how biblio's cast finally got built after a settings page
   sat unused.
5. **Only then**: auth, sharing, templates, export fidelity, the second
   artefact.

Resist starting at step 5 because it demos well. A tool that produces one
finished thing is a product; five unfinished ones is a prototype.

## 13. Decisions taken

**Private first.** Nothing is shared in the demo. Everything a person writes
stays theirs, encrypted the way biblio does it.

That is the right call for a demo and it has one consequence worth building in
on day one, while it is free: **keep private thinking and finished artefacts as
two separate kinds of record**, even though both are private now. Raw capture
is one thing; a finished status update is another. When the organisation buys
it and asks for team libraries, retention and "share this with my director",
the change is then a switch on one class of record rather than a rewrite of the
storage layer. Merging them now and separating them later is the expensive
version of this decision, and it is the version that happens by default.

**One payer now, an organisation later.** The demo is bought by the person
running it, so day one needs no admin console, no SSO, no seat management, no
billing.

The insurance that costs nothing: **put an owner id on every record from the
first migration**, even while there is only ever one. Adding an identity column
to a table with real data in it is a migration, a backfill and a bug; having a
column nobody reads yet is free. Same for the API — take the user from a
session rather than assuming there is one.

What stays deferred until it is actually bought: SSO (Google Workspace, Entra),
roles and permissions, audit trail, admin console, SOC 2 and the compliance
paperwork. All of it is real work and none of it makes the demo better.

## 14. Still to decide

1. **Which artefact is first?** The narrowest one where the current tools are
   worst.
2. **Does it live inside the tools people already use** (a Slack app, a Google
   Docs add-in, a Teams tab) or is it a place you go? biblio is a place you go,
   because a diary is. Work software usually is not.
3. **What is the name, and does it share biblio's design language?** The
   restraint transfers well. The warmth may not.

---

*Status: biblio is at 0.23.0 with the cast, the dictation decision above, and
the voice button removed. This brief was revised at that point.*

*Companion reading in the biblio repo, if the new conversation has access to
it: `docs/your-world.md` (why a world model, and why correcting a generated
result cannot work), `docs/maya/character.md` (the restraint), `docs/sessions.md`
(attended-use measurement), `docs/user-management/` (access, privacy, devices),
`docs/releases.md` (update discipline), and `CHANGELOG.md`, which is the whole
history with the reasoning attached.*
