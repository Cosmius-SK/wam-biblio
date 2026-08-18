import { NextResponse } from "next/server";
import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";
import { currentUser } from "@/lib/users/limits";

export const runtime = "nodejs";

/**
 * Insights: two numbers a day, per device.
 *
 * Absolute totals rather than increments, and one slot per device, so nothing
 * can be double-counted and two devices cannot overwrite each other. The
 * server does no arithmetic and stores nothing it was not sent.
 *
 * The whole permitted shape is in lib/insights/schema.ts. Anything else in the
 * body is dropped here rather than trusted — the contract is enforced, not
 * merely documented.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: true, stored: false });

  const token = blobToken();
  if (!token) return NextResponse.json({ ok: true, stored: false });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const date = typeof body.date === "string" && DATE.test(body.date) ? body.date : null;
  const device = typeof body.device === "string" ? body.device.slice(0, 64) : null;
  if (!date || !device) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  // Only the two agreed fields survive this. Anything else a client sends —
  // now or by mistake later — is dropped rather than stored.
  const clean = {
    date,
    device,
    entries: Math.max(0, Math.min(10_000, Math.round(Number(body.entries) || 0))),
    activeMinutes: Math.max(0, Math.min(1440, Math.round(Number(body.activeMinutes) || 0))),
    updatedAt: Date.now(),
  };

  try {
    await writeSyncJson(`insights/${user.sub}/${date}/${device}.json`, JSON.stringify(clean), token);
  } catch {
    // Losing a metric must never be visible to the person being measured.
    return NextResponse.json({ ok: true, stored: false });
  }
  return NextResponse.json({ ok: true, stored: true });
}

/** What is actually held about the person asking, so they can look at it. */
export async function GET(request: Request) {
  const user = await currentUser();
  const token = blobToken();
  if (!user || !token) return NextResponse.json({ held: null });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const device = url.searchParams.get("device");
  if (!date || !DATE.test(date) || !device) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const held = await readSyncJson(
      `insights/${user.sub}/${date}/${device.slice(0, 64)}.json`,
      token,
    );
    return NextResponse.json({ held: held ?? null });
  } catch {
    return NextResponse.json({ held: null });
  }
}
