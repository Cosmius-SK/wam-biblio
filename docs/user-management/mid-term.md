# Mid term — the circle, then a community

**Status: sketch.** Not designed yet; here so the short-term choices don't paint
us into a corner.

## Roughly who

A wider circle first (ten to twenty), then some community for genuine global
testing — which community is still an open question.

## What breaks first, in order

1. **The allowlist.** Adding people one at a time from the owner view stops
   being sane somewhere around fifteen, even without a redeploy. Needs invite
   links or self-serve sign-up with approval — the first thing that genuinely
   requires a **user store** rather than a list.
2. **Google's OAuth user cap.** The app is already published, so the Testing
   limit never applies — but while its sensitive scopes are unverified there is
   a cap on how many accounts may **ever** grant consent, counted over the
   project's lifetime and **not resettable**. Lifting it means passing Google's
   verification review: a privacy policy, a homepage, and a wait measured in
   weeks. **Start this early; it is the longest lead time in the whole plan and
   it blocks everything.**
3. **The economics.** At ~75¢–$1 per active person per month, a hundred people
   is **$75–300/month, indefinitely, out of pocket.** This is the wall, and it
   is not a technical one.
4. **Support.** Ten people with questions is a group chat. A hundred is a job.

## The shape of the answer

- **Real accounts** — the "Option C" already discussed: a server that verifies
  Google identity, stores users, and issues sessions. The short-term session
  work is deliberately the first half of this.
- **Free by default, live AI opt-in.** Sample mode costs nothing and is a
  genuine experience; live AI becomes the thing a user brings their own key for,
  or contributes toward. This is what makes free-at-scale survivable.
- **Per-user quotas** rather than per-user caps — the short-term limiter
  generalises directly.
- **Abuse controls**, which have not been needed once so far and will be needed
  the first day it is public.

## What to keep from the short term

Everything, deliberately: the session cookie, the allowlist (becomes a user
table), the limiter (becomes quotas), the insights schema, Maya's tour and her
feedback space. Nothing in the short-term plan is throwaway.

## Open questions

- Which community? The answer changes onboarding, tone, and moderation entirely.
- Does biblio stay invite-only even when public? Scarcity suits a journal.
- Is sample mode honestly good enough to be the free tier? Worth testing on the
  first two people, since the whole free-at-scale model rests on it.
