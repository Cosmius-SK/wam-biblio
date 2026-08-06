# User management

biblio was built for one person. These notes plan the road from that to many —
in three horizons, only the first of which is being designed in detail.

| | Who | Status |
|---|---|---|
| [**Short term**](./short-term.md) | Two or three close people — real end users with no idea how apps are built | **Being planned now** |
| [**Mid term**](./mid-term.md) | A wider circle, then some community for global testing | Sketch |
| [**Long term**](./long-term.md) | A proper product with tiers and a cost model | Sketch, needs market research |

## Where things stand today

The app is genuinely single-user, but less so than it looks — a few foundations
already carry over:

- **Identity exists.** Google sign-in resolves a real profile
  (`lib/googleAccount.ts`, `lib/drive.ts` → `getIdentity`), currently used only
  to unlock sync.
- **Users are already isolated from each other, cryptographically.** Each Google
  account keeps its own sync key in its own hidden Drive folder, so every
  account encrypts to a different cloud slot. Two people on one deployment
  cannot read each other's journals, and neither can the person who deployed it.
- **Cost is already measured**, per device, in `lib/usage.ts` + the `ailog`
  table — it just isn't *enforced* anywhere.

What is missing is the part that makes it multi-user: **a door** (who may come
in), **a limit** (what each may spend), and **a way to learn** from people
without reading what they wrote.

## The principle these notes keep returning to

> Numbers and settings, never words.

Everything in the short-term plan follows from that. The journal is theirs; the
insights are counts. Where a person deliberately writes *to* Shiva — Maya's
feedback space — that is a different act, and the interface has to say so.
