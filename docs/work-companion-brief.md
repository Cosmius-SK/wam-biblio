# A work companion, on biblio's foundations — handoff brief

**Written for a fresh conversation that has never seen biblio.** Paste it in
whole; it is meant to work cold.

It carries four things: what the product is, the decisions already taken, what
can be lifted from biblio literally, and the platform lessons that cost real
time there and would cost them again here.

Its sibling **biblio** is a personal journal — Next.js (App Router),
TypeScript, Tailwind, Dexie/IndexedDB, deployed on Vercel, Anthropic for text
and Gemini for images. Local-first, end-to-end encrypted, one user. This
product shares its spine and almost none of its purpose.

---

## 1. The product, in a paragraph

A personal AI partner for corporate work. It sits beside one person through
their working day, takes the mess — a spoken thought after a meeting, a page of
notes, a half-formed argument — and turns it into the thing their job actually
requires. It is not a chatbot and not a wiki. It removes the mundane half of
knowledge work so the person spends their attention on the half that needs
judgement.

---

## 2. The honest market read

"AI that helps with work documents" is the most crowded space in software.
Microsoft Copilot, Notion AI, Gemini for Workspace, Glean, and thirty startups
are already there, most of them sitting on the customer's data. **Competing on
"it writes your documents" loses.**

The wedge is not the writing. It is that **the output is already yours**.

A generic model writes generic documents. What none of these tools does well is
produce something you can send without rewriting it: your company's template,
your team's vocabulary, your client's name spelled the way your firm spells it,
the tone your director reads without wincing.

That is not a prompt. It is a **model of the organisation**, held by the
product and consulted on every generation.

---

## 3. The spine: an organisation model

biblio's most important feature is not its illustrations. It is a small local
store of the people, places and things a person keeps writing about. When an
entry mentions someone the journal knows, their *description* — never their
name — is injected into the image prompt, so the same family looks like the
same family in every picture.

The principle to carry over:

> **The world model is the feature. Generation is one consumer of it.**

For work:

| biblio holds | This product holds |
|---|---|
| People (a face, chosen once) | Stakeholders — role, seniority, what they care about, how they like to be written to |
| Places (a few words) | Clients, accounts, systems, products |
| Things (a detail or two) | Terminology, acronyms, the words your firm uses and the ones it avoids |
| — | **Brand**: logo, palette, type, the deck master |
| — | **Formats**: what a "steerco pack" or a "status update" looks like *here* |

**Learn from biblio's mistake.** Its cast was built as a settings page first,
and a settings page is a page nobody visits. It only worked once the offer was
made *at the moment it explained itself* — right after a generic result, when
the person had just seen why it mattered. Build the organisation model the same
way: never a setup wizard, always an offer attached to a disappointing output.

---

## 4. Decisions already taken

**Private first.** Nothing is shared in the demo. Everything a person writes
stays theirs, encrypted the way biblio does it.

One consequence to build in on day one, while it is free: **keep private
thinking and finished artefacts as two separate kinds of record**, even though
both are private now. Raw capture is one thing; a finished deck is another.
When the organisation buys it and asks for team libraries, retention and "share
this with my director", the change is then a switch on one class of record
rather than a rewrite of the storage layer. Letting them blur together now and
separating them later is the expensive version — and blurring is what happens
if nobody decides.

**One payer now, an organisation later.** The demo is bought by the person
running it. Day one needs no admin console, no SSO, no seat management, no
billing.

The insurance that costs nothing: **put an owner id on every record from the
first migration**, even while there is only ever one, and read the user from a
session rather than assuming there is one. A column nobody reads is free;
adding an identity column to a table full of real data is a migration, a
backfill and a bug.

Deferred until somebody is actually buying: SSO (Google Workspace, Entra),
roles and permissions, audit trail, admin console, SOC 2 and the compliance
paperwork. All real work, none of it makes the demo better.

**The first artefact is a PowerPoint deck.** Chosen because it is where the
most time is wasted. Section 5 is how to do it so that it works.

---

## 5. The first artefact: a deck

Be clear-eyed: **a deck is the hardest artefact, not the easiest.** It is three
things that can each be wrong — an argument, a layout, and a brand — and a
generated deck that is wrong in any of them has to be rebuilt slide by slide.
It is still the right first choice, because it is where the pain is and where
generic AI output is most visibly useless.

There is one rule that decides whether this works.

### Approve the argument, then render

**Do not generate a deck from a note.** Generate an *outline*, let the person
fix it in ten seconds, and only then make slides.

1. **From the note, produce the argument.** A list of slides, each with:
   - the **claim** — the one sentence that slide is making
   - the **support** — two to four points underneath
   - a **shape** — which kind of slide this is (below)
2. **Show them the outline and let them edit it.** Reorder, cut, retitle, merge.
   It is a list; it takes a minute. This is the step that makes the product
   trustworthy.
3. **Render only what they approved**, applying the template.
4. **Never regenerate a whole deck to fix one slide.** Regenerate that slide.

This is biblio's hardest-won principle applied to a new problem: **choosing
terminates, correcting does not.** A second attempt at a whole artefact loses
the parts that were right along with the part that was wrong. Editing an
outline is choosing. Editing fourteen rendered slides is correcting, and it
never ends.

### Seven slide shapes, and no more on day one

`title` · `contents` · `statement` (one claim, large) · `bullets` ·
`two-column` (compare / before-after) · `chart` (one simple bar or line) ·
`next-steps`

That covers the overwhelming majority of business decks. An eighth shape is
always tempting and never the reason someone does or doesn't adopt this.

### Producing the file

- **`pptxgenjs`** generates a real `.pptx` from JavaScript, in the browser or
  on the server. It opens in PowerPoint and Google Slides and stays fully
  editable afterwards, which matters more than it sounds: nobody will trust a
  tool whose output they cannot fix by hand.
- **Define one master in code** — brand colours, a typeface, logo position, a
  footer. Do **not** try to read the company's existing `.potx` on day one;
  that is a project of its own and it is not what makes the demo land.
- Ship "Download the deck". Links, sharing and co-editing come later.

### The test that decides whether the product is real

Take a real note. Generate. Open it in PowerPoint. **Present it without editing
a single slide.** If you cannot, the product does not exist yet — and the fix
is almost always in the outline step, not in prettier slides.

---

## 6. What it inherits from biblio — principles

Expensive to arrive at, and not style preferences.

1. **Capture must be instant and offline.** Anything between having a thought
   and the thought being in the box is the enemy. Local-first storage; sync
   afterwards.
2. **Choosing terminates; correcting does not.** See §5. Wherever possible let
   people *choose from structure* rather than *correct a result in adjectives*.
3. **Structure as data, rendered locally.** Never ask an image model for
   anything with text in it. A mind map, a workflow, an org chart: have the
   model emit a small JSON structure and render it yourself. Real text,
   legible, free after the first call, offline, consistent with the rest of the
   app.
4. **Silence is a valid output.** biblio's companion mostly says nothing. An
   assistant that comments on everything is one people turn off in week two.
5. **Nothing invented.** Summaries, entities and structure must be faithful to
   what the person actually wrote. A work tool that quietly embellishes is
   worse than none: it will be sent to a client.
6. **Updates never happen underneath someone.** The service worker waits, says
   a new version is ready, and lets them choose — after the draft is saved.
7. **The changelog is the single source of release notes**, written before
   shipping and parsed at build time. No second copy to drift.

---

## 7. What it inherits from biblio — code

| Piece | What it does | Why take it |
|---|---|---|
| `lib/crypto.ts`, `lib/keyvault.ts` | PBKDF2 → AES-GCM; key wrapping via envelopes (one key sealed under both a passcode and a recovery phrase) | Solved, including "forgot the passcode" without a backdoor |
| `lib/sync.ts`, `lib/syncKeys.ts` | Differential sync: per-record encrypted blobs, content-hash ledger, tombstones | Two devices converge without a server that can read anything |
| `lib/drafts.ts` | Debounced local save, pre-encrypted `sendBeacon` push | A phone freezing mid-sentence does not lose words |
| `lib/session.ts` | Attended-use sessions: clock runs only while visible, clamped, idle-credited | Honest usage measurement, not tab-open time |
| `lib/insights/` | Two numbers a day per device, absolute totals, a schema file as the privacy contract | Telemetry that survives being read by the people measured |
| `lib/users/` | HMAC session cookie (Edge-safe), allowlist, invite links, device registry, per-user daily caps | A complete small-scale access system — enough until an IdP is needed |
| `lib/ai/structurePrompt.ts`, `lib/ai/client.ts` | Messy input → structured JSON, with prompt caching | The core pass; the schema is the only real edit |
| `lib/names.ts` | Puts back names dictation mangles, from a list you hold | Directly reusable — see lesson 2 |
| `lib/world/` | The world model + deterministic local rendering from structured choices | The pattern the organisation model should follow |
| `next.config.mjs` | Version + release notes read from `CHANGELOG.md` at build time | Small, removes a whole class of drift |

**Do not take:** biblio's companion character and copy (a different product
needs a different register), the illustration pipeline, and the mood /
significance fields (meaningless at work, and forcing them adds noise).

---

## 8. What must be different

**Output leaves the building.** biblio has deliberately never had sharing. This
product is defined by what it hands over: `.pptx`, `.docx`, `.pdf`, a link, a
Slack message. Export fidelity is not a feature here, it is the point.

**Identity, when it is bought.** biblio's `lib/users/` is a good small-scale
allowlist, not identity infrastructure. When the organisation buys, move to an
IdP (WorkOS, Auth0, Clerk) rather than growing the allowlist.

**Compliance becomes a product requirement.** SOC 2, GDPR, data residency,
retention, DPA, subprocessor list, and a straight answer to "does our data
train your models". Enterprise buyers ask on the first call.

**Cost model.** biblio's caps exist to protect one wallet. Here they protect a
margin, per seat.

---

## 9. The line to hold

The product **notices commitments; it does not manage them.** The moment it
holds deadlines and done-states it becomes a task manager and inherits
reminders, overdue, snoozing and sync-with-Jira. Surfacing *"three weeks ago
you said you'd have this by Friday"* is the assistant being useful. A checkbox
is a different company.

---

## 10. Platform lessons — read before writing a line

Every one found the hard way in biblio, in production, usually on a phone.

1. **Do not build voice capture on the browser's speech API. biblio tried it
   and removed it.** What a browser hands a website is a small, low-latency
   engine that commits each word as it is spoken with almost no lookahead: no
   punctuation, names replaced by the nearest word it knows, and "going to
   help" settled as "going to hell" before the rest of the sentence can argue.
   A week went into making it behave and none of it closed the gap. Instead:
   - **Point at the dictation already on the device** — the mic key on a phone
     keyboard, `Windows + H`, the mic key on a Mac. It hears a whole sentence
     before deciding any word in it, punctuates natively, and is free. Say
     which key; do not offer a worse button beside it, because the easier path
     is the one people take and then judge the product by.
   - **For anything you control, use real ASR** (Whisper/Deepgram-class, about
     half a cent a minute). A demo's first minute is somebody talking to it.
   - **Names are yours to fix, not the engine's.** No transcription of any size
     knows your colleague or your product. Correct them from the list you
     already hold, matching only *capitalised* near-misses — an engine returns
     a name capitalised even when it gets it wrong, and that capital is what
     makes automatic correction safe. `lib/names.ts` does exactly this.
2. **Google's browser OAuth token lasts about an hour and has no refresh
   token.** A silent refresh works only where the browser still has a Google
   session, which an installed PWA on iOS usually does not; otherwise it needs
   a popup, and a popup needs *transient user activation*. Two traps: returning
   to the foreground grants no activation, and **WebAuthn consumes activation
   rather than issuing any** — a fingerprint cannot buy you a popup. Renew
   early and silently; where you cannot, spend a tap the person is already
   making, at most once an hour, and pass the account `hint` so the window
   closes itself.
3. **A phone freezes the page when you switch apps, and an in-flight `fetch`
   dies with it.** Anything that must survive leaving goes via `sendBeacon`,
   computed *before* the moment — an `await` on the way out is a bet the page
   will still be running.
4. **Never report only at the end of a session.** biblio's usage numbers were
   computed from finished sessions, and a session finishes as the page closes.
   Testers who visited and wrote looked like testers who never came.
5. **Sync: hash what is on disk, not what arrived.** Recording the incoming
   record's hash after a merge left the two sides permanently disagreeing and
   the text grew on every pass. Keep the list of record types in **one** file:
   it has been wrong in two files here, and sync fails silently, so a mismatch
   does not error anywhere — it just means something a person wrote never
   arrives.
6. **Newest-wins beats clever merging.** A concatenating merge for conflicting
   drafts never converged: each side saw the other's join as a new conflict.
7. **Corporate proxies return HTML on a 403.** A Zscaler block page is
   indistinguishable from a permission refusal unless you check the body.
   Detect it and say "your network blocked this". That one cost a day.
8. **A fix nobody can install is not a fix.** A browser looks for a new service
   worker on navigation and then roughly once a day; refreshing does not force
   it. Call `registration.update()` on arrival and on returning to the tab. Two
   of biblio's bug reports were this and nothing else.
9. **Work out the marginal cost before architecting around it.** biblio's owner
   was one conversation from building a local model to avoid "paying for
   sentence correction". The correction was 190 tokens on a call that already
   happened — 0.019¢ an entry — against a 350MB download that would not have
   run on the test phone.
10. **Fail closed on allowlists, fail open on gates that can lock you out.**
11. **Provider wallet limits are the real ceiling.** Application caps exist so
    nobody ever *reaches* the provider's; the provider's spend limit is what
    makes a runaway cost cents instead of a weekend.
12. **Cost shape:** text shaping is roughly a tenth the cost of image
    generation. A product built on structured text and locally rendered
    diagrams is dramatically cheaper to run than one that generates pictures.

---

## 11. Day one

Ordered so each step is usable before the next begins.

1. **Capture.** One screen: a box that saves as you type, and one button.
   Local-first, so it works offline and survives a closed tab. No login, no
   folders, no formatting, no title field.
2. **One model call, returning structure.** Not a chat — one pass over the
   mess, returning fixed fields rather than prose:

   | Field | What it holds |
   |---|---|
   | `title` | short, from their own words |
   | `points` | what they actually said, tidied, as separate points |
   | `questions` | what the note leaves open |
   | `next` | the single next step, or nothing |
   | `mentions` | people, clients, projects, systems named |

   Fields rather than prose because everything downstream is built from them.
   You cannot lay out a paragraph. About a quarter of a cent per note on the
   cheap model.
3. **The outline.** From those fields, the argument for a deck: slides, each
   with a claim, its support, and a shape. Shown as an editable list. This is
   the step people will judge the product by, and it is cheap — it is text.
4. **Render one shape well** — `bullets` — into a real `.pptx` they can
   download and open. One shape done properly beats seven done roughly.
5. **The remaining six shapes**, then the brand master.
6. **Only then**: the organisation model, seeded by an offer at the first
   generic result. Then auth, sharing, export breadth.

Resist starting at step 5 or 6 because they demo well. A tool that produces one
finished thing is a product; five unfinished ones is a prototype.

---

## 12. Still open

1. **Does it live inside the tools people already use** (a Slack app, a Teams
   tab, a PowerPoint add-in) or is it a place you go? biblio is a place you go,
   because a diary is. Work software usually is not, and this is the assumption
   most expensive to get wrong.
2. **What is it called**, and does it share biblio's design language? The
   restraint transfers well. The warmth may not.

---

*Status: biblio is at 0.23.0 — the cast, the organisation-model pattern, the
dictation decision above, and its own microphone removed. This brief was
revised at that point.*

*Companion reading in the biblio repo, if the new conversation has access to
it: `docs/your-world.md` (why a world model, and why correcting a generated
result cannot work), `docs/sessions.md` (attended-use measurement),
`docs/user-management/` (access, privacy, devices), `docs/releases.md` (update
discipline), and `CHANGELOG.md`, which is the whole history with the reasoning
attached.*
