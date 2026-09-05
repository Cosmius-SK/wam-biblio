# Your world — people, places and things

**Status: prompt richness (0.21.0) and the cast itself (0.23.0) are built** —
the store, the sync, the avatar builder, Settings › Your world, and the
injection into every illustration, and the offer after an illustration. What
remains are the other two touchpoints under "Where it appears" below — faces
on the review screen, and Maya's earned offer. The outcome of a long
conversation about why generated illustrations feel generic, and what would
actually fix it.

## The problem, stated exactly

An entry about a father and two sons on a scooter produced a competent
watercolour of *a* father and *two* sons. Everything in it was right except the
only thing that mattered: none of them were anybody.

Two causes, and they need different answers.

**The prompt was asking for atmosphere.** The instruction says *"mood, light,
place, atmosphere… no names or private identifiers"* — and "no names" had
quietly become "no specifics". The entry was full of detail that identifies
nobody: three on a scooter with the smaller boy standing in front, 3D glasses
in the dark, a stack of small chairs bought on the way home. None of it reached
the image model.

**Nothing in biblio knows who anyone is.** Every illustration invents its cast
from scratch, so a family is a different family in every picture.

## Why correcting the image cannot work

The obvious answer — regenerate, refine, try again — is a trap, and it is worth
writing down why so nobody rebuilds it later.

Image models are a dice roll: a second attempt redraws *everything*, so the
parts that were right are lost along with the part that was wrong. And to steer
it you would have to express the difference between a drawn face and your own
face **in adjectives**. Nobody can do that. It is gradient descent by
vocabulary, at four cents a step, with no guarantee any step goes the right way.

**Choosing terminates. Correcting does not.**

## The shape

One store, three kinds. Only one of them needs a likeness.

| | What it needs | How it is made |
|---|---|---|
| **People** | a likeness | an avatar builder, or one photo |
| **Places** | atmosphere | words, or one of your own photographs |
| **Things** | a detail or two | words — *"a pale green scooter"* is the whole entry |

## People — the avatar builder

Not a picture editor. **A structured description editor with a live preview.**

Choosing "full beard, glasses, mid-thirties, medium build" produces exactly the
words a prompt needs — but by picking from options rather than staring at a text
box wondering how to describe your own face. The preview says instantly whether
you chose right.

It emits two things:

- **a face** — for the cast list, a person's page, and the reassurance of having
  got it right
- **a set of attributes** — which is what actually goes into every illustration

The person experiences picking a face. The image model receives a good
description. Nobody had to write *"roughly triangular jaw"*.

**It must feel like play, not admin.** Big preview, instant feedback, a shuffle
button for getting near quickly. If it reads as a form, nobody fills it in and
the whole feature dies with it.

### Why a chosen avatar may beat a photograph

Not the compromise — arguably the better answer:

- **Children change faces every eighteen months.** A photo dates; a chosen
  avatar is whoever you decided they are.
- Some people will never want their family fed to an image model at all.
- You may have no photograph of your grandmother at the age you remember her.
- Nothing leaves the device. The builder is entirely local and deterministic.

A photo route stays available for people who want accuracy and accept the
trade — one photo, once, to write a description, shown and editable before it is
ever used, then never sent again.

## Places — description, not likeness

The distinction that saves a great deal of work: **nobody minds that the cinema
isn't precisely their cinema. Everybody notices that the father isn't them.**

*"A multiplex lobby, neon strips, dark patterned carpet"* is genuinely enough,
costs nothing, and needs no third-party service.

Where a place deserves a real reference — your own street, your kitchen — use a
photograph **you took**. Free, the angle you actually see, more yours than a
stranger's upload, and it raises no licensing question.

### The Google Maps route, and why not

Fetching Place Photos or Street View imagery and restyling them was considered
and set aside twice over.

**Licensing.** That imagery is licensed content, much of it contributed by other
people. The Maps Platform terms restrict caching and derivative works and
passing content to non-Google services. A stylised redraw of a Place Photo is
about as clean an example of a derivative work as could be constructed — and the
standard cost advice, *cache the source photos*, runs straight into the caching
restrictions. Not a foundation for a privacy-first journal.

**And it answers the wrong question.** A Place Photo of a cinema is a stock shot
of a facade. The entry was about a dark auditorium and 3D glasses; the exterior
appears nowhere in the day. Journals are mostly about interiors — a kitchen, a
corridor, a street at dusk — which no mapping service has photographed and none
of which need it.

## Things

Resist ceremony. Nobody wants to fill in a form about their scooter. Things
should accumulate almost invisibly, or arrive in the entry's own words.

## How any of it reaches a picture

The existing privacy rule stays exactly as it is — **no names, no identifiers**.

```
entry mentions "Theva"  →  matched to someone in your world  →  the DESCRIPTION is injected
```

Names never leave. Descriptions do. So the scooter becomes *"a man in his late
thirties with a beard and glasses, a boy of about seven, a smaller boy of five
standing in front"* — the family becomes recognisable without anyone being
named.

## Where it appears

**It accumulates from writing; it is never configured up front.** A journal that
opens with a character-creation screen is a game.

- **After an illustration — built (0.23.0).** The picture is drawn first,
  exactly as asked, and then: *"Theva and Yazh don't have faces yet. Shall I remember them, so they
  look the same in every entry?"* — per person, with *not now* meaning not now.
  Nothing blocks the image. And having just seen the generic result, the offer
  explains itself.
- **On the review screen** — people already appear there as extracted entities;
  those become small chips with faces.
- **From Maya, once earned** — a name recurring across several entries:
  *"You've written about Theva a few times now. Want me to remember him?"*
- **Settings › Your world** — for anyone who would rather do it deliberately.

## What biblio already has

Most of the foundation is sitting unused. Every entry Claude shapes returns
`entities` — the people and things it mentioned — stored on every entry ever
written and currently feeding only a weak relatedness score and the search
index. **biblio already knows who recurs.**

Entries also carry a real `EntryPlace` with a name and coordinates.

## Work notes are not going here

A tester used biblio to think through a work problem — *"I need to learn
Lovable, in 2 days I have to come up with…"* — which raised whether biblio
should carry personas: a diary voice and a professional one, with illustrations
becoming mind maps and workflows.

Decided against, and the reasoning is worth keeping. The capture reflex is
identical, but nothing downstream is: work output needs structure rather than
prose, export rather than keeping, sharing rather than privacy, and a companion
with a different register. A journal that also does decks is mediocre at both.

It went to a sibling product instead — see
[docs/work-companion-brief.md](work-companion-brief.md), which is also where
this file's central idea goes next: an organisation model in place of a cast.

## Worth more than the pictures

Once a cast exists, other things follow nearly for free:

- **Ask** gets real: *"what have I written about Theva?"* — presently a text
  search that catches a word, not a person
- **A thread per person** — every entry someone appears in, as a life rather
  than a list
- **Maya notices better** — she can currently only see themes

Images are one consumer of a world model. The world model is the feature.

## Cost

One-time assets, not recurring spend. A place is built once and reused for
ever; a life might hold thirty of them. The avatar builder costs nothing at all,
being local and deterministic.

## Honest limits

- **Consistency is not likeness.** Even at its best this gives "a family that
  could be yours", not a portrait. The photographs attached to an entry are
  already the record of what actually happened; the illustration may be better
  at being a memory of the *feeling*.
- **Image models get cautious about children.** Prompts describing specific
  young children are sometimes refused or blandly generalised. Test this early
  rather than building on the assumption.
- **A cast is a different object from a diary.** Writing about your children is
  ordinary; a structured record describing them is slightly different in kind.
  Still theirs, still encrypted, still only on their devices — but worth
  deciding deliberately, particularly once other people are cataloguing
  relatives who never chose to be.
- **A flat vector avatar may not blend into a watercolour.** Use the attributes
  in prompts first; test passing the avatar itself as a reference image
  separately.

## Decisions taken

**A framed portrait.** Each person is a portrait in biblio's palette, shown in
the app inside a frame — a photograph on a shelf rather than a contact avatar.
Tapping it turns it over to the description underneath. It suits an app that
already thinks of itself as a book on a shelf, and it sets the right
expectation: a portrait is understood to be an interpretation, where a profile
picture is understood to be a likeness.

**It syncs.** biblio is mobile-first but never device-bound, so a cast that
lived on one phone would be a cast you rebuilt on the laptop. Encrypted like
entries and drafts, as a new synced record type.
