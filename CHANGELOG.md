# Changelog

Every release gets an entry here, written **before** it ships. This is the one
source of truth: the in-app "what's new" card reads from this file, so there is
never a second copy to drift.

Each entry has two halves, because it has two audiences:

- **What's new** and **Fixed** — for the person using biblio. Plain words, no
  jargon, no file names. If a sentence needs a developer to explain it, rewrite
  it. **These two are the only sections shown inside the app**, so nothing here
  may mention costs, keys, admin tools or anything else that is the deployment
  owner's business rather than the reader's.
- **For the owner** — anything about running the deployment. Never shown to
  anyone else.
- **Under the hood** — for whoever maintains it. Still plain, but specific.

And, where it applies, **Notes** — anything that behaves differently, needs a
one-off action, or upgrades stored data.

Newest first. Dates are the day the work landed.

> Entries before 0.5.0 were reconstructed from the commit history when this file
> was started, so they are summaries rather than release-time notes.

---

## 0.18.1 — 21 August 2026

### What's new

- **Maya sounds like a person now.** She was picking the oldest, most robotic
  voice your device had. She now finds the most human one available, speaks
  more slowly, and — the part that matters most — **pauses where a person would
  breathe**, instead of running one sentence into the next at the same pace.
- **The voice list puts the good ones first**, with a ★ beside the newer,
  human-sounding voices. If nothing is starred, your device only has the older
  ones — an iPhone can download better ones under Settings › Accessibility ›
  Spoken Content › Voices.

### Under the hood

- Voice choice preferred `localService`, which reliably picked the worse of the
  two generations every platform now ships: the neural voices are usually the
  network ones. Voices are scored by the words in their names — natural,
  neural, wavenet, premium, enhanced, online — since that is the only signal
  the API gives.
- Lines are spoken clause by clause with a real gap after each: ~420ms at a
  full stop, ~200ms at a comma. The orb settles in those gaps, which is what
  makes it read as breathing rather than as an audio meter.
- Rate 0.94 → 0.86, pitch 1.02 → 1.0.

---

## 0.18.0 — 21 August 2026

### What's new

- **Maya moves when she speaks.** Not a loop running while she happens to be
  talking — the light shifts **with each word**, so it reads as someone
  speaking rather than as a notification blinking.
- **She is mostly still.** A slow breath when she has nothing to say, and a
  clear change when she does. That contrast is what makes you look up.
- **Shaping an entry now shows her thinking** rather than a loading circle.

### Under the hood

- `MayaOrb` — a membrane whose outline flows, a light that drifts off-centre so
  the flow reads as depth, and a glow that exists only while she talks. Four
  states: resting, speaking, thinking, bloom.
- Speech synthesis exposes no audio levels, but it does announce word
  boundaries; `maya.onPulse` turns those into beats. Platforms that never
  report boundaries — iOS among them — get a heartbeat at her speaking rate
  instead, so she never falls still mid-sentence.
- Only transform, opacity and border-radius animate, so it stays on one
  composited layer. Reduced-motion still stills it.

---

## 0.17.2 — 21 August 2026

### Fixed

- **When a network blocks a photo upload, biblio now says so.** Company web
  filters and VPNs turn uploads away in a way that looks identical to Google
  refusing permission — so biblio was telling people to go and re-tick a box
  that was already ticked. It now recognises the difference and says your
  account is fine and the network isn't.

### Under the hood

- Google answers in JSON; a page of HTML means something answered on its
  behalf. That is the tell, and it is enough to separate an intercepted request
  from a genuine refusal.

---

## 0.17.1 — 21 August 2026

### Fixed

- **Trying a photo again is now actually a different attempt.** When Google
  turned an upload away, biblio kept the same refused permission slip for
  another hour and used it again — so granting access appeared to change
  nothing.

### For the owner

- **"Check Google Drive" now uploads a few bytes and deletes them again.**
  Creating the folder and writing into it fail for different reasons, and only
  the second one was ever the problem — the check was passing while the app
  failed.
- When an attachment is refused, the picker shows Google's own words beneath
  it, to you only.

---

## 0.17.0 — 21 August 2026

### What's new

- **The capture screen tells you whether your words have travelled.** A quiet
  line — *on your other devices*, *saved here, still sending*, or *will send
  when you're back online*. Sync being silent is right until it isn't working.

### Fixed

- **A device left open now receives what you wrote elsewhere.** biblio only
  checked for changes when a page was freshly loaded, so a laptop sitting on
  another tab never learned that anything had happened on your phone. It now
  also checks when you come back to it.
- **A draft written on a phone is sent immediately** instead of after a pause
  long enough for the phone to freeze the page first.
- **Photos are no longer blocked before you try.** biblio was refusing to offer
  the picker based on a stale note about what Google had granted — which was
  wrong often enough to stop people whose Drive worked perfectly well. It now
  simply tries, and offers to sort out permission only if Google actually
  objects.

### Under the hood

- `AutoSync` pulls on session start and on returning to a tab after a while,
  not only on mount.
- `flushDraft(push)` calls `autoPush()` directly rather than going through the
  four-second debounce the rest of the app uses.
- The draft's sync state is derived from the sync ledger's last-pushed hash
  against what is on disk — no new bookkeeping to drift.

### For the owner

- Enabling the **Google Drive API** in the Cloud project that owns the OAuth
  client was the missing piece behind every photo failure. "Check Google Drive"
  now reports `folder ready`, which is what a working Drive looks like.

---

## 0.16.1 — 21 August 2026

### Fixed

- **An unfinished entry now simply keeps your most recent edit.** When the same
  draft was changed on two devices, biblio tried to keep both versions by
  joining them — and the two devices then kept re-joining each other's joins
  until the draft filled with dividers and stopped travelling altogether. The
  newest edit wins now, the way you'd expect.

### Under the hood

- Drive errors kept Google's own explanation instead of replacing it with a
  friendly sentence. A disabled API, the wrong project and a declined
  permission all arrive as 403 and mean entirely different things — the
  friendly text goes to the writer, the raw body to the owner's diagnostic.

### For the owner

- **"Check Google Drive" now prints what Google actually said.** It previously
  showed only biblio's own wording, which was the same for every cause.

---

## 0.16.0 — 21 August 2026

### What's new

- **biblio has a face in your browser tab** at last, instead of a grey globe.
- **Maya asks before she speaks.** The walkthrough now begins by offering her
  voice rather than assuming it. Text is a perfectly good answer, and you can
  change your mind in Settings.
- **Telling Maya feels like telling Maya.** Say it to her and she takes it to
  whoever makes biblio — which is how it actually works, and warmer than being
  handed a stranger's name. That a person reads it is still said every time.

### Fixed

- **An unfinished entry stops going in circles.** Editing the same draft on two
  devices could leave them arguing with each other, and eventually syncing
  nothing at all.
- **Photos: no more trip to Settings.** When Google refuses permission, the fix
  is now a button where you are, and it asks Google properly rather than being
  told the question has already been answered.

### Under the hood

- The sync ledger recorded the hash of the record that *arrived* rather than
  the one that ended up on disk. For a merged draft those differ, so the device
  re-pushed forever and each pass grew the text. It now hashes what is stored,
  and a merge where one side already contains the other is a no-op.
- `getAccessToken(interactive, force)` can send `prompt: "consent"`, which is
  the only way to re-offer a Drive permission someone declined.
- A `DRIVE_FORBIDDEN` during upload now flips the picker into its
  grant-permission state instead of printing an error and stopping.

### For the owner

- **Costs are hidden from everyone but you.** Guests see how many calls they
  made, not what they cost their host — totting up someone else's money is how
  a person quietly stops using something. Revisit when the group is no longer
  a closed one.
- **"Check Google Drive"** on the owner page asks Google outright and prints
  exactly which permissions came back, then tries the operation that actually
  fails. Drive lives entirely in the browser, so the server-side checks could
  never say anything about it.
- New `/api/me` answers one question — are you the owner — so owner-only detail
  can be withheld without publishing your address to every visitor.

---

## 0.15.1 — 20 August 2026

### Fixed

- **A draft written on a phone now leaves the phone.** It was being saved, but
  the moment you switched away the upload was cut off mid-flight — so it
  travelled from a laptop but never from a phone.
- **Photos attach on the first try.** biblio kept asking you to reconnect Drive
  no matter how many times you did.

### Under the hood

- Phones freeze a backgrounded page immediately, killing any request in
  progress. A pre-encrypted copy of the draft is now kept ready and sent with
  `sendBeacon`, which survives the freeze. Drafts carrying photo thumbnails can
  exceed the beacon size limit and fall back to the ordinary push.
- The Drive upload path was spending its user gesture on a silent token refresh
  of up to eight seconds; the popup that followed was then blocked as
  unsolicited. It now uses a token already in hand, or asks outright while the
  tap still counts.

### For the owner

- **Release notes now have an audience.** Only "What's new" and "Fixed" reach
  the in-app card. A new "For the owner" section — costs, keys, admin tools —
  is never shown to anyone else. The previous card told every reader about a 4¢
  test button on a page they cannot open.

---

## 0.15.0 — 20 August 2026

### Fixed

- **An unfinished entry now really does follow you between devices.** Start
  something on your phone and it will be waiting on your laptop.
- **A friendlier first screen.** Anyone opening biblio for the first time was
  being asked for a passcode nobody had given them. Now they get the welcome.
- **Photos wouldn't attach**, and said only "upload failed". Google asks about
  saving files to your Drive as a separate tick, and it's easy to miss — biblio
  now notices, explains, and offers to sort it out.

### Under the hood

- The draft was uploading fine but the route that reads a record back rejected
  its type, so every pull was refused before it started. The list of record
  types now lives in one file that every part imports.
- Middleware picks the door by whether Google sign-in is configured; `/unlock`
  stays reachable and the two doors link to each other.
- Granted scopes are recorded at sign-in, so a missing Drive grant is caught
  before a 403 rather than after one.

### For the owner

- **Draw a test image** on the owner page. Listing models proves a key is valid;
  it doesn't prove anything can be drawn with it — quotas, safety filters and
  model availability all fail at generation time. Now you can find that out in
  one tap instead of by writing a real entry and hoping. About 4¢ a press.

---

## 0.14.2 — 20 August 2026

### Fixed

- **Settings › Security could claim a sealed journal was unprotected.** When a
  browser couldn't quietly reach your Google account, biblio treated "couldn't
  check" as "not sealed" and offered to seal it again — which would have minted
  a fresh recovery phrase and silently invalidated the six words you'd written
  down. It now says it can't tell, and offers to check properly instead of
  guessing.

---

## 0.14.1 — 20 August 2026

### Fixed

- **The owner page showed a dead 404 to anyone not signed in**, including the
  owner themselves. It now sends you to the sign-in door and brings you back
  afterwards. A signed-in visitor who isn't the owner still gets the 404, which
  is the case where hiding the page actually matters.

### Notes

- Changing `AUTH_SECRET` invalidates every existing session cookie by design.
  After changing it, sign in with Google again — the old cookie can no longer
  be verified, which is the whole point of the secret.

---

## 0.14.0 — 19 August 2026

### What's new

- **A connections check on the owner page.** One button, and it tells you
  whether Anthropic, Gemini and the storage are actually answering — with the
  real error when something isn't, rather than a shrug.
- It also reports the things that quietly decide who gets in: whether sign-in is
  configured, who is on the allowlist, whether the owner address matches, and
  what the daily limits are set to.

### Under the hood

- `/api/health`, owner-gated and 404 to everyone else. Anthropic is exercised
  with a real one-token request — the only way to know a key genuinely works —
  Gemini with a free model listing that also reports which models can draw, and
  the Blob store with a write-and-read-back.
- Keys are described by prefix and length. Nothing prints a secret.
- Flags an `OWNER_EMAIL` that is set but missing from the allowlist, which would
  otherwise present as a mysterious 404 on this very page.

---

## 0.13.0 — 18 August 2026

### What's new

- **Tell Maya.** A place to say what's annoying, confusing, broken or missing —
  Settings › Tell Maya, whenever you like.
- **She asks three times, ever.** After your first entry, after three days, and
  after two weeks. One question each, never the same one twice, and ignoring her
  is a complete answer — the question simply isn't asked again.
- **It is unmistakably different from writing a journal entry.** Different
  colour, different type, and a sentence at the top of every single one:
  *whatever you write here is sent, and they will read it. Nothing else you
  write in biblio ever is.*
- **You can see what goes with it.** The version and device are shown, and you
  can untick them.

### Under the hood

- `lib/feedback.ts` holds the three prompts and the once-only bookkeeping;
  timing is anchored to the first entry and offered at the start of a visit, so
  it arrives when someone is already here rather than interrupting them into
  being here.
- `maya.invite()` is deliberately distinct from `maya.ask()`: an invitation must
  be taken on purpose, so ordinary interaction can never accidentally accept one
  the way it answers a presence check.
- `/api/feedback` writes to `feedback/<sub>/<timestamp>.json` — a separate route
  and a separate store from anything journal-shaped. Nothing from a journal can
  reach this path, and nothing on this path is confused with a journal.
- `/insights` gains a messages section. It is the only place in the whole
  deployment where anyone's words appear, and they are there because they were
  sent deliberately.

### Notes

- Set `NEXT_PUBLIC_OWNER_NAME` so the box can say who it goes to by name.
  Without it, it says so generically rather than pretending nobody reads it.

---

## 0.12.0 — 18 August 2026

### What's new

- **Maya shows you around the first time.** Nine short cards: who she is, what
  happens to your words, where things are, and how to keep the journal safe.
  Then she gets out of the way.
- **She points at real things.** The steps about the write button, the tabs and
  Settings light up the actual button on your screen, not a picture of one.
- **Skippable, and it remembers.** Leave halfway and it picks up where you left
  it. Finish it and it never asks again.
- **Run it again whenever** — Settings › Maya → *Maya, show me around*.
- **She reads it aloud** if her voice is on, and stays quiet if it isn't.

### Under the hood

- `components/tour/` — `steps.ts` holds her words, `Tour.tsx` the driver. The
  spotlight cuts a hole in the scrim with a large-spread box shadow, and picks
  the visible copy of a target when one renders in both the phone and laptop
  bars.
- It never starts unprompted on `/welcome`, `/unlock`, `/offline` or `/capture`:
  the doors, and a blank page someone may already be writing on.
- Progress lives in local settings, but a second device doesn't re-run it —
  a device that pulled down a journal with entries in it plainly belongs to
  someone who has been here before. That is a better signal than a flag, and it
  needs no new state.
- The passcode and biometric steps **link** to Settings rather than repeating
  those flows, so there is one place those settings live and it is the place
  people will look for them later.

### Notes

- The private-voice choice from the onboarding design is deliberately not here
  yet. On-device transcription doesn't exist, and offering a choice we can't
  honour would be worse than not offering it.

---

## 0.11.0 — 18 August 2026

### What's new

- **A page that shows you exactly what biblio knows about you.**
  Settings › Privacy. Two numbers a day — entries written, minutes spent — and
  it shows the real record, not a description of one.
- **And what it never knows**: your words, your photos, your questions, and —
  deliberately — your moods and themes. Those look like plain metadata but are
  worked out from what you wrote, and would say more about your week than a
  paragraph would.
- **One switch to keep the numbers on your device.** Nothing is sent, and the
  app behaves identically either way.

### Under the hood

- `lib/insights/schema.ts` is the contract in code: if a field is not in that
  file it is not collected, and adding one is a deliberate edit to a file whose
  only purpose is to be read by someone checking. It also lists what is never
  gathered, because a list of what *is* gathered is easy to extend quietly.
- Totals are **absolute per day per device**, not increments — a retry or a lost
  response cannot inflate anything, and two devices cannot overwrite each other.
- The API re-derives the permitted shape rather than trusting the body, so the
  contract is enforced and not merely documented.
- The raw session timeline never leaves the device. Only the daily sum does:
  "opened at 2am, seven times" is exactly what this is designed not to hold.
- The presence-check answer has a real recording site that returns immediately
  while `COLLECT_ANSWERS` is false — nothing written down, rather than written
  down and withheld. Maya's marks are now separate buttons, so the wiring is
  genuine rather than notional.
- Owner-only `/insights`, gated to the owner's Google account and returning a
  404 to everyone else so its existence isn't advertised.

### Notes

- People appear in the owner view as the last few characters of their Google id,
  never a name or address.

---

## 0.10.0 — 18 August 2026

### What's new

- **biblio works offline now.** Open it on a plane, in a basement, on a train
  through a tunnel — your journal is on the device and the app around it now
  comes with it. Anything you write is saved and syncs when you're back.
- **Updates wait for you.** When a newer version is ready, a small note appears
  and you refresh when you're ready. It will never reload the page out from
  under you mid-sentence, and your draft is saved before it does.
- **A short note on what changed**, once, after an update. This is it.
- **A version and build number** in Settings › About, worth quoting if you ever
  report something odd.

### Under the hood

- `public/sw.js`, hand-written and small enough to read in one sitting.
  Content-hashed build output is cached outright; pages are network-first with
  the last good copy behind them; `/api/*` is never cached, because a stale
  answer from a model or a store is worse than no answer.
- The worker deliberately does **not** call `skipWaiting()` on install. Waiting
  is what gives the reader the say.
- `/sw.js` and `/offline` are public in the middleware — a worker that cached a
  redirect to the unlock screen would be worse than no worker.
- Version and release notes are read from `package.json` and `CHANGELOG.md` at
  **build time** in `next.config.mjs`, so the in-app card cannot drift from the
  file and no host-specific runtime file access is involved.

### Notes

- The "what's new" card never appears on a first-ever visit; there is no before.
- Settings › About no longer claims the app works offline as if it always did.
  It does now.

---

## 0.9.0 — 18 August 2026

### What's new

- **A passcode that actually seals your journal.** Settings › Security → *Protect
  my journal*. Until now, anyone who got into your Google account could have read
  everything; now it takes your Google account **and** your passcode together.
- **A six-word recovery phrase**, shown once when you set the passcode. It is the
  only other way in — and the screen says so plainly, before you set it rather
  than after you've lost it.
- **Opening your journal on a new device** asks for the passcode, or the phrase
  if that's what you have.
- **Nobody can undo a forgotten passcode.** Not the person who built this. That's
  the trade for "not even the host can read it", and it's stated where it can be
  acted on.

### Under the hood

- `lib/keyvault.ts`: the sync key `K` is no longer stored. It is kept as
  *envelopes* — the same key sealed under the passcode and under the recovery
  phrase — so any one of them yields the same key. Reuses `encryptJSON` /
  `decryptJSON` unchanged.
- No passcode hash is stored anywhere, on any server. A wrong passcode fails as
  an AES-GCM authentication failure, so being right proves itself.
- **The migration writes envelopes alongside the plaintext, never over it.** The
  plaintext is dropped automatically only after a device that did *not* write
  the envelopes has opened one — proof before removal, because every other
  mistake here costs a redeploy and this one costs the journal.
- A fresh phrase is minted whenever the passcode changes: the old one has just
  been typed into a screen someone may have been standing behind.
- `lib/recovery.ts` holds the wordlist. The phrase is used as a passphrase
  string and never decoded to bits, so the list can change later without
  invalidating a single existing phrase.

### Notes

- Existing journals keep working untouched. Sealing happens when you set a
  passcode, not before.
- While migrating, Settings › Security offers **"Check my passcode works on this
  device"** — run it on a *second* device to retire the old unsealed key.
- There is deliberately **no reset by email or Google**. It would hand the
  journal back to whoever took the Google account, and the sealing would have
  bought nothing.

---

## 0.8.0 — 18 August 2026

### What's new

- **Daily limits, so nobody can run up someone else's bill.** Each person has a
  gentle ceiling on how much AI they use in a day, and a separate one for
  illustrations — which cost several times more than everything else.
- **Hitting a limit is not a failure.** Maya says so plainly: *"That's all the
  drawing I can do today — it comes back tomorrow."* You can still write, still
  save, still read. Nothing you wrote is affected.
- **The person paying isn't rationed.** The deployment owner is exempt from the
  personal limits.

### Under the hood

- `lib/users/limits.ts` keeps counters at `meter/<UTC date>/<sub>.json` in the
  Blob store, plus a `_deployment` counter as a whole-app circuit breaker.
- Checked **before** the model call, recorded **after** it, from the real token
  usage the routes already return — so a call that fails costs nobody anything.
- Wired into all four AI routes. Listing image models is not metered; it makes
  no image.
- Defaults: `USER_DAILY_USD=0.30`, `USER_DAILY_IMAGES=5`,
  `GLOBAL_DAILY_USD=2.00`. Any of them set to `0` disables that limit.
- Personal caps apply to identified people who are not the owner. Traffic
  through the older passcode door is unidentified, so only the deployment-wide
  breaker covers it — which is fine while both doors are open and testers only
  arrive through Google.
- Capture, Ask and Reflect now render the `hint` alongside the error, so
  "it comes back tomorrow" actually reaches the reader.

### Notes

- **These limits are the second line of defence, not the first.** Set a monthly
  spend limit on the Anthropic workspace and a daily request quota on the Google
  project. Those do not depend on this code being correct.
- UTC days, so a counter cannot be rolled by changing a device clock.

---

## 0.7.0 — 18 August 2026

### What's new

- **Sign in with Google.** There's now a proper front door at `/welcome`. Your
  Google account is how biblio knows which journal is yours — no shared secret,
  nothing to remember, and it stays yours across future versions.
- **Your passcode still works.** Nothing has been taken away; both ways in are
  open.
- **See your devices.** Settings › Devices lists everything you've signed in on
  and when each was last used. You can rename them, and disconnect one you no
  longer have.
- **Honest about what disconnecting does.** It stops that device syncing and
  asks it to clear itself next time it's opened. It cannot reach a phone that's
  switched off or never opened again — the screen says so, in those words.

### Under the hood

- `lib/users/session.ts` signs an HttpOnly cookie with Web Crypto HMAC, so the
  Edge middleware can verify it without a Node dependency or a round trip to
  Google on every request.
- `/api/auth/session` verifies the access token with Google once, checks the
  allowlist, registers the device and issues the cookie.
- The allowlist lives in the Blob store (`users/allowed.json`) with
  `ALLOWED_USERS` as a first-deploy seed — people are not deployment secrets.
- **Both doors open at once, on purpose.** The passcode is not removed in the
  release that adds sign-in; see `docs/releases.md`, "Cutovers".
- With no allowlist configured the Google door stays shut, so enabling it is
  always a deliberate act rather than a side effect of deploying.

### Fixed

- **Drafts could not actually sync.** The sync API only accepted record types
  `e`, `p`, `r` and `k`, so every draft push was rejected with a 400 the client
  never showed. Drafts saved locally but never left the device.

### Notes

- Two new environment variables: `AUTH_SECRET` (falls back to `APP_PASSCODE`)
  and `ALLOWED_USERS`. Without them, sign-in simply isn't offered and everything
  behaves exactly as before.
- Everyone signing in must also be a **Test user** on the Google OAuth consent
  screen, or Google blocks them before biblio ever sees the request.

---

## 0.6.0 — 18 August 2026

### What's new

- **Maya notices when the page goes quiet.** If nothing has moved for a while
  she asks whether you're still there — and what she says depends on where you
  are. On the writing page she assumes you're thinking, not gone. In the gallery
  she wonders if you've found something you'd forgotten.
- **Answering is one tap** — a small mark beside her words, or simply touching
  anything at all. She isn't testing you.
- **Say nothing and she closes the book**: the visit ends and, if you use the
  fingerprint or face lock, the app locks. Whatever you were writing is already
  saved.
- **You choose the wait** — 5, 10, 20 or 30 minutes, or never, in
  Settings › Maya. Answer once and she leaves you alone for longer next time.
- **She mentions an unfinished draft** when you come back after a while. Once a
  day at most, and never while you're already looking at it.

### Under the hood

- `presenceAsk()` in `lib/mayaLines.ts` composes per-surface lines from parts,
  with a no-repeat memory. The surface comes from the pathname, so no context
  plumbing was needed.
- Answer chips are contextual, never a mood rating — a word on the capture
  screen rather than faces. Which one was tapped is **not recorded**; see
  `docs/user-management/privacy.md`.
- `maya.ask()` carries an answer callback and a silence callback; the silence
  path flushes the draft, ends the session at the last real interaction, and
  relocks via a new `biblio-relock` event that `BioLock` listens for.
- Confirmed stillness is credited to the session; unconfirmed stillness is not.
  The idle window grows to 2× then 3× after each confirmation.

### Notes

- If Maya is set to Silent she doesn't ask, and a quiet screen simply stops the
  clock as before.

---

## 0.5.0 — 18 August 2026

### What's new

- **Your writing is no longer lost.** Start an entry, put the phone down, take a
  call, close the tab — it is still there when you come back. biblio saves what
  you are writing as you write it.
- **Start on one device, finish on another.** A half-written entry now travels
  with you. Begin a thought on your phone and pick it up on your laptop.
- **Photos come with it.** Pictures are saved into your own Google Drive the
  moment you attach them, so they are waiting on the other device too — and
  keeping an entry no longer pauses while photos upload.
- **A dot on the ✎ button** when something unfinished is waiting, so you know
  without going to look.
- **Coming back is quiet.** The page is simply already filled in, with a line
  saying when you left it. If it has been sitting more than a week, biblio asks
  first rather than surprising you with an old thought.
- **Discard this draft** — one tap, when a thought turns out not to be worth
  writing. Any photos you had attached are removed too.

### Under the hood

- New `lib/drafts.ts`: a single draft in a new Dexie table, debounced local
  writes at 800 ms and a flush on `visibilitychange` (the reliable signal in an
  installed PWA, unlike `beforeunload`).
- Drafts sync as record type `"d"` through the existing encrypted pipeline.
  Divergence between two devices joins both texts rather than picking a winner —
  nothing in this feature may discard a sentence.
- `PhotoAttach` now encrypts and uploads on attach, so a draft carries
  `EntryPhoto` references instead of blobs. Abandoned drafts clean their photos
  out of Drive, best effort.
- New `lib/session.ts`: sessions measured as *attended* use. The clock runs only
  while the document is visible, credits two minutes of stillness so reading
  counts, and discards any single delta longer than the idle threshold so a
  suspended laptop cannot invent an evening. Device-local, numbers only.
- Dexie schema v7 adds `drafts` and `sessions`. Additive; older builds ignore
  both.

### Notes

- The database upgrades itself on first open. Nothing to do.
- Photos now need Google Drive connected *at the moment you attach them* rather
  than when you keep the entry. The picker already told you if it wasn't.

---

## 0.4.0 — August 2026 · Maya, and a layout for bigger screens

### What's new

- **Maya arrives** — a quiet presence in the footer who greets you, notices
  patterns once your journal is old enough to have any, and can speak aloud in a
  woman's voice if you want her to.
- **A laptop layout**: one control bar, a full-width journal, and book mode as a
  real two-page spread.
- **The header, bar and footer stay put** instead of scrolling away.
- **A quotation in the footer** each day, with a slow band of light crossing it.
- **Filters open as a proper drop-down** you can tap away from.

### Under the hood

- `lib/maya.ts` singleton with voice selection, ambient ducking and iOS priming;
  `lib/mayaLines.ts` for her words and `lib/mayaObserve.ts` for local-only
  pattern detection.
- Fixed chrome with matching spacers; `components/PageBar.tsx` owns the tabs.
- Theme resolution stamped deterministically before first paint.

---

## 0.3.0 — July 2026 · The journal as a book

### What's new

- **Book mode** — flip through your journal a page at a time, with long entries
  flowing onto further leaves.
- **Three tabs**: Timeline, Gallery and Ask. Themes became a filter.
- **Settings redesigned** as a hub with focused pages.
- **Illustrations** for entries, with a style picker and a choice of which image
  leads the card.
- **An itemised record of what AI has cost you**, in Settings › AI.

### Under the hood

- CSS multi-column pagination for book pages; per-leaf column counts on desktop.
- Gemini model discovery at request time rather than a hardcoded model id.
- Usage ledger in a new `ailog` table.

---

## 0.2.0 — July 2026 · Sync, and an account

### What's new

- **Sign in with Google** and your journal reassembles itself on a new device —
  nothing to remember, nothing to copy across.
- **Photos** attach to entries, encrypted into your own Google Drive.
- **A biometric lock** for the app on this device.

### Under the hood

- Differential sync: one encrypted blob per record, a local ledger of content
  hashes, tombstones for deletions, real byte progress.
- The sync key lives in the account's hidden Drive `appDataFolder`.
- `lib/blobStore.ts` resolves whether the Blob store is private or public.

---

## 0.1.0 — 2026 · The first four phases

### What's new

Capture a messy thought by voice or text; Claude shapes it into a coherent
entry you review before keeping. Themes group your writing, a Reflection
summarises where you are, and you can ask your own journal questions. Encrypted
backup and restore.

### Under the hood

Next.js App Router, Dexie/IndexedDB as the source of truth, stateless AI routes,
Web Crypto for end-to-end encryption, and a sample mode so nothing bills until
you opt in.
