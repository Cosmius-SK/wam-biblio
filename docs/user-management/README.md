# User management

biblio was built for one person. These notes plan the road from that to many.

Two ways in: **by horizon** (who, and when) and **by system** (how it actually
works). The horizons say what we are aiming at; the systems are what gets built.

## By horizon

| | Who | Status |
|---|---|---|
| [**Short term**](./short-term.md) | Two or three close people — real end users with no idea how apps are built | **Designed** |
| [**Mid term**](./mid-term.md) | A wider circle, then some community for global testing | Sketch |
| [**Long term**](./long-term.md) | A proper product with tiers and a cost model | Sketch, needs market research |

## By system

| | |
|---|---|
| [**access.md**](./access.md) | Google, passcode, biometric — and the key wrapping that ties them together |
| [**onboarding.md**](./onboarding.md) | All of it stitched into one sequence, narrated by Maya |
| [**privacy.md**](./privacy.md) | What is collected, what never is, and the choices surfaced rather than decided |
| [**devices-and-deletion.md**](./devices-and-deletion.md) | The device registry, and deletion at four radii |

## App-wide foundations these depend on

| | |
|---|---|
| [**sessions.md**](../sessions.md) | Attended-use sessions — the lock, Maya's nudge and "time spent" all sit on this |
| [**drafts.md**](../drafts.md) | The single draft: persisted, synced, and a prerequisite for the idle lock |
| [**releases.md**](../releases.md) | Versioning, offline, and how updates reach people |
| [**maya/character.md**](../maya/character.md) | Who Maya is — portable across projects, not biblio-specific |
| [**auth-and-sync-lifecycle.md**](../auth-and-sync-lifecycle.md) | The two independent auth cycles as built today |

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
  table — it just isn't *enforced* anywhere, and it only records successes.

What is missing is the part that makes it multi-user: **a door** (who may come
in), **a limit** (what each may spend), **a way to leave** (deletion that
actually reaches everything), and **a way to learn** from people without reading
what they wrote.

## The principles these notes keep returning to

> **Numbers and settings, never words.**

The journal is theirs; the insights are counts. Where a person deliberately
writes *to* Shiva — Maya's feedback space — that is a different act, and the
interface has to say so.

> **Say what is actually true.**

A disconnect that cannot reach a stolen phone is called *Disconnect*, not
*remote wipe*. A passcode nobody can recover is described that way before it is
set, not after it is lost. The privacy claim is enforced by architecture rather
than by promise — and where it isn't, that gets said too.
