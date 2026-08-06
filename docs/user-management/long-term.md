# Long term — a product

**Status: sketch, pending market research.** Recorded so the numbers are honest
whenever the conversation happens.

## Why the economics are unusually good

biblio is **local-first**. Entries live on the device, sync is ciphertext in
cheap object storage, and there is no per-user database, no server-side search,
no media pipeline. Almost every journalling product carries per-user
infrastructure cost. biblio's marginal cost is **almost entirely the AI**, and
that is measurable per action.

| Per active user / month | |
|---|---|
| AI (typical) | ~75¢–$1 |
| AI (heavy) | ~$2.70 |
| Infrastructure | rounding error |

At **$6–10/month** there is real margin, and the margin *improves* with scale
rather than degrading.

## Tiering, provisionally

- **Free** — sample mode: the whole app, local previews instead of live AI. Not
  crippled; genuinely usable. It is also the honest funnel.
- **Paid** — live AI with a monthly allowance sized well above typical use
  (the ledger already shows what typical is), illustrations included, sync.
- **Bring your own key** — for the technical minority; costs nothing to serve
  and removes the ceiling.

The allowance model matters: caps sized in *entries and illustrations* rather
than tokens, because nobody buying a journal should ever meet the word "token".

## What has to exist first

Everything in the mid-term, plus: payments and subscription state, a billing
portal, dunning, refunds, tax, a terms of service and privacy policy that
survive scrutiny, GDPR/DPDP data export and deletion, data-processing terms
with Anthropic and Google, and support with an actual response time.

**Realistically 4–8 weeks beyond the app**, most of it not the enjoyable kind.

## The questions market research should answer

- What do people actually pay for a journal today, and what do they expect for it?
- Is the AI the reason they'd pay, or is the calm the reason?
- Does "local-first, end-to-end encrypted, we cannot read your journal" read as
  a feature to ordinary buyers, or as noise? **It is biblio's sharpest
  differentiator and the hardest to communicate.**
- Would the illustration cost survive a heavy user on a flat fee? (At 4¢ each,
  a hundred a month is $4 — the one line item that can invert a tier's margin.)

## The thing worth protecting

Whatever the model, the reason biblio exists is that it made one person write
who hadn't been able to. Any tier that makes the blank page harder to reach —
a paywall before the first sentence, a nag, a limit felt while writing — costs
more than it earns.
