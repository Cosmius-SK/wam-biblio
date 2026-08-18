import { cookies } from "next/headers";
import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";
import { estimateCost } from "@/lib/format";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";
import { ownerEmail } from "./allowlist";

/**
 * Per-person daily caps.
 *
 * Two layers protect the bill and only one of them is this code. The wallet
 * backstops — a spend limit on the Anthropic workspace, a request quota on the
 * Google project — are the real ceiling, because they do not depend on us
 * being correct. This layer exists so nobody ever *reaches* those, and so a
 * runaway costs cents rather than a weekend.
 *
 * Images are the lever: an illustration is 4–10× everything else.
 *
 * Counters live in the Blob store at `meter/<date>/<sub>.json`. Read-modify-
 * write races are possible and harmless at this size; the backstops are what
 * make that acceptable rather than optimistic.
 */
const IMAGE_COST_USD = 0.04;

export type Kind = "text" | "image";

export interface Meter {
  calls: number;
  images: number;
  costUsd: number;
}

export interface Denial {
  error: string;
  code: "daily_cap" | "daily_images" | "deployment_cap";
  hint: string;
}

const ZERO: Meter = { calls: 0, images: 0, costUsd: 0 };

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const userDailyUsd = () => num("USER_DAILY_USD", 0.3);
const userDailyImages = () => num("USER_DAILY_IMAGES", 5);
const globalDailyUsd = () => num("GLOBAL_DAILY_USD", 2);

/** UTC day, so a counter can never be rolled by changing a device clock. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const path = (who: string) => `meter/${today()}/${who}.json`;
const GLOBAL = "_deployment";

async function read(who: string): Promise<Meter> {
  const token = blobToken();
  if (!token) return { ...ZERO };
  try {
    const m = (await readSyncJson(path(who), token)) as Partial<Meter> | null;
    return {
      calls: Number(m?.calls) || 0,
      images: Number(m?.images) || 0,
      costUsd: Number(m?.costUsd) || 0,
    };
  } catch {
    return { ...ZERO };
  }
}

async function write(who: string, m: Meter): Promise<void> {
  const token = blobToken();
  if (!token) return;
  await writeSyncJson(path(who), JSON.stringify(m), token);
}

/** Who is asking, from the session cookie. Null on the passcode door. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    return await verifySession(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

function isOwner(user: SessionUser | null): boolean {
  const owner = ownerEmail();
  return !!owner && !!user?.email && user.email.toLowerCase() === owner;
}

/**
 * Whether a call may proceed.
 *
 * Personal caps apply to identified people who are not the owner: the point is
 * to bound what a guest can spend of someone else's money, not to ration the
 * person paying. Traffic through the older passcode door is unidentified, so
 * only the deployment-wide breaker covers it.
 */
export async function checkCaps(user: SessionUser | null, kind: Kind): Promise<Denial | null> {
  const globalCap = globalDailyUsd();
  if (globalCap > 0) {
    const all = await read(GLOBAL);
    if (all.costUsd >= globalCap) {
      return {
        error: "biblio's AI is resting for today.",
        code: "deployment_cap",
        hint: "It comes back tomorrow. Nothing you wrote is affected.",
      };
    }
  }

  if (!user || isOwner(user)) return null;

  const mine = await read(user.sub);
  if (kind === "image") {
    const cap = userDailyImages();
    if (cap > 0 && mine.images >= cap) {
      return {
        error: "That's all the drawing I can do today.",
        code: "daily_images",
        hint: "It comes back tomorrow — your entry is saved either way.",
      };
    }
  }
  const cap = userDailyUsd();
  if (cap > 0 && mine.costUsd >= cap) {
    return {
      error: "That's all the thinking I can do today.",
      code: "daily_cap",
      hint: "It comes back tomorrow. You can still write, and save without AI.",
    };
  }
  return null;
}

/** Record what a call actually cost, after it happened. */
export async function recordUsage(
  user: SessionUser | null,
  kind: Kind,
  costUsd: number,
): Promise<void> {
  const bump = (m: Meter): Meter => ({
    calls: m.calls + 1,
    images: m.images + (kind === "image" ? 1 : 0),
    costUsd: Math.round((m.costUsd + costUsd) * 1e6) / 1e6,
  });
  try {
    await write(GLOBAL, bump(await read(GLOBAL)));
    const who = user?.sub;
    if (who) await write(who, bump(await read(who)));
  } catch {
    // A meter we cannot write must not fail the call the person already made
    // and already paid for. The wallet backstops are the real ceiling.
  }
}

/** Cost of one model call, from the usage the routes already return. */
export function costOf(model: string, usage?: { inputTokens: number; outputTokens: number }): number {
  if (!usage) return 0;
  return estimateCost(model, usage.inputTokens, usage.outputTokens);
}

export const imageCost = () => IMAGE_COST_USD;
