import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { blobToken, listPrefix, readSyncJson, writeSyncJson } from "@/lib/blobStore";
import { currentUser } from "@/lib/users/limits";
import { allowedEmails, ownerEmail } from "@/lib/users/allowlist";
import { FLOOR_MODEL, CEILING_MODEL } from "@/lib/ai/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only self-diagnosis.
 *
 * Every link that can silently break — a rotated key, a project without the
 * API enabled, a Blob store that isn't connected — is exercised for real and
 * reports the *actual* error rather than a shrug. Swapping keys is exactly
 * when this is needed, which is exactly when nobody wants to find out by
 * writing an entry and watching it fail.
 *
 * Nothing here prints a secret: keys are described by prefix and length.
 */
interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

function describeKey(v: string | undefined): string {
  if (!v) return "not set";
  return `${v.slice(0, 8)}… (${v.length} chars)`;
}

async function checkAnthropic(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      id: "anthropic",
      label: "Anthropic (writing, ask, reflect)",
      ok: false,
      detail: "ANTHROPIC_API_KEY is not set.",
    };
  }
  try {
    // The smallest real call there is: one token out. Proves key, model,
    // network and workspace in one go, for a fraction of a cent.
    const res = await new Anthropic({ apiKey: key }).messages.create({
      model: FLOOR_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return {
      id: "anthropic",
      label: "Anthropic (writing, ask, reflect)",
      ok: true,
      detail: `${describeKey(key)} · reached ${res.model} · escalates to ${CEILING_MODEL}`,
    };
  } catch (e) {
    return {
      id: "anthropic",
      label: "Anthropic (writing, ask, reflect)",
      ok: false,
      detail: `${describeKey(key)} · ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function checkGemini(): Promise<Check> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      id: "gemini",
      label: "Gemini (illustrations)",
      ok: false,
      detail: "GEMINI_API_KEY is not set — illustrations are off.",
    };
  }
  try {
    // Listing models is free and generates nothing.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${key}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        id: "gemini",
        label: "Gemini (illustrations)",
        ok: false,
        detail: `${describeKey(key)} · ${res.status} ${body?.error?.message ?? "request refused"}`,
      };
    }
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const all = data.models ?? [];
    const images = all
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => /image/i.test(n));
    return {
      id: "gemini",
      label: "Gemini (illustrations)",
      ok: images.length > 0,
      detail:
        images.length > 0
          ? `${describeKey(key)} · ${all.length} models, ${images.length} can draw (e.g. ${images.slice(0, 2).join(", ")})`
          : `${describeKey(key)} · ${all.length} models, but none can generate images on this key`,
    };
  } catch (e) {
    return {
      id: "gemini",
      label: "Gemini (illustrations)",
      ok: false,
      detail: `${describeKey(key)} · ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function checkBlob(): Promise<Check> {
  const token = blobToken();
  if (!token) {
    return {
      id: "blob",
      label: "Storage (sync, limits, insights)",
      ok: false,
      detail: "No *BLOB_READ_WRITE_TOKEN — connect a Blob store with the read-write token box ticked.",
    };
  }
  const stamp = new Date().toISOString();
  try {
    const mode = await writeSyncJson("sync/_health.json", JSON.stringify({ checkedAt: stamp }), token);
    const back = (await readSyncJson("sync/_health.json", token)) as { checkedAt?: string } | null;
    const ok = back?.checkedAt === stamp;
    return {
      id: "blob",
      label: "Storage (sync, limits, insights)",
      ok,
      detail: ok ? `wrote and read back (${mode} store)` : "wrote, but read back something unexpected",
    };
  } catch (e) {
    return {
      id: "blob",
      label: "Storage (sync, limits, insights)",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkDoor(): Promise<Check[]> {
  const emails: string[] = await allowedEmails().catch(() => []);
  const owner = ownerEmail();
  const secret = process.env.AUTH_SECRET;
  return [
    {
      id: "auth",
      label: "Sign-in",
      ok: !!secret || !!process.env.APP_PASSCODE,
      detail: secret
        ? `AUTH_SECRET set (${secret.length} chars)`
        : process.env.APP_PASSCODE
          ? "AUTH_SECRET not set — falling back to APP_PASSCODE. Set a real one."
          : "No AUTH_SECRET and no APP_PASSCODE: Google sign-in is disabled.",
    },
    {
      id: "allowlist",
      label: "Who may come in",
      ok: emails.length > 0,
      detail:
        emails.length > 0
          ? `${emails.length} allowed: ${emails.join(", ")}`
          : "Empty — the Google door is shut until someone is on the list.",
    },
    {
      id: "owner",
      label: "Owner",
      ok: !!owner && emails.includes(owner),
      detail: owner
        ? emails.includes(owner)
          ? `${owner} — exempt from daily caps, sees this page`
          : `${owner} is set but is NOT on the allowlist — add it to ALLOWED_USERS.`
        : "OWNER_EMAIL not set — you'd be capped like a guest and locked out of this page.",
    },
    {
      id: "google",
      label: "Google client",
      ok: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      detail: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        ? "NEXT_PUBLIC_GOOGLE_CLIENT_ID set"
        : "Not set — sign-in and photo attachments won't work.",
    },
  ];
}

function checkCaps(): Check {
  const n = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
  const usd = n("USER_DAILY_USD", 0.3);
  const img = n("USER_DAILY_IMAGES", 5);
  const global = n("GLOBAL_DAILY_USD", 2);
  return {
    id: "caps",
    label: "Daily limits",
    ok: global > 0,
    detail: `${usd ? `$${usd}/person` : "no per-person spend cap"} · ${img ? `${img} images/person` : "no image cap"} · ${global ? `$${global} whole deployment` : "NO deployment breaker"}`,
  };
}

/**
 * Is anything actually landing?
 *
 * The insight pipeline fails silently on purpose — nobody's numbers are worth
 * an error message on their screen — so a report that never arrives looks
 * exactly like a person who never came. This is the only place the difference
 * can be seen, which is why it is worth a check of its own.
 */
async function checkInsights(): Promise<Check> {
  const label = "Insights (who is turning up)";
  const token = blobToken();
  if (!token) {
    return { id: "insights", label, ok: false, detail: "No Blob store, so nothing can be recorded." };
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const files = await listPrefix("insights/", token);
    const people = new Set<string>();
    const days = new Set<string>();
    let reportingToday = 0;
    for (const f of files) {
      const [, sub, date] = f.pathname.split("/");
      if (!sub || !date) continue;
      people.add(sub);
      days.add(date);
      if (date === today) reportingToday++;
    }
    const allowed = (await allowedEmails()).length;
    return {
      id: "insights",
      label,
      ok: people.size > 0,
      detail:
        `${people.size} of ${allowed} allowed ${allowed === 1 ? "person has" : "people have"} ` +
        `ever recorded a day · ${days.size} ${days.size === 1 ? "day" : "days"} held · ` +
        `${reportingToday} ${reportingToday === 1 ? "device" : "devices"} reported today.`,
    };
  } catch (e) {
    return {
      id: "insights",
      label,
      ok: false,
      detail: e instanceof Error ? e.message : "Could not read the insights store.",
    };
  }
}

export async function GET() {
  const user = await currentUser();
  const owner = ownerEmail();
  if (!user || !owner || user.email?.toLowerCase() !== owner) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [anthropic, gemini, blob, door, insights] = await Promise.all([
    checkAnthropic(),
    checkGemini(),
    checkBlob(),
    checkDoor(),
    checkInsights(),
  ]);

  const checks: Check[] = [anthropic, gemini, blob, ...door, insights, checkCaps()];
  return NextResponse.json({
    checkedAt: Date.now(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    build: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    ok: checks.every((c) => c.ok),
    checks,
  });
}
