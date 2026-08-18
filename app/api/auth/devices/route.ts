import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/users/session";
import { forgetDevice, listDevices, renameDevice, revokeDevice, seenDevice } from "@/lib/users/devices";

export const runtime = "nodejs";

async function whoAsks() {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** What holds a copy of this journal, and when each was last seen. */
export async function GET() {
  const user = await whoAsks();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ devices: await listDevices(user.sub) });
}

/**
 * Touch "last seen", once per visit. Answers with `revoked` so a disconnected
 * device learns it should clear itself the next time someone opens it.
 */
export async function POST(request: Request) {
  const user = await whoAsks();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    platform?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { revoked } = await seenDevice(user.sub, {
    id: body.id.slice(0, 64),
    label: (body.label ?? "A device").slice(0, 60),
    platform: (body.platform ?? "unknown").slice(0, 60),
  });
  return NextResponse.json({ ok: true, revoked });
}

/** Rename a device — "Chrome on Android" says nothing when you own three. */
export async function PATCH(request: Request) {
  const user = await whoAsks();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; label?: string };
  if (!body.id || !body.label) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  await renameDevice(user.sub, body.id, body.label);
  return NextResponse.json({ ok: true });
}

/**
 * Disconnect a device, or forget one entirely.
 *
 * Disconnect cuts it off from future sync and asks it to clear itself when it
 * is next opened. It is a request, not a wipe: a phone that is never opened
 * again keeps what it already has, and the UI says so.
 */
export async function DELETE(request: Request) {
  const user = await whoAsks();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (url.searchParams.get("forget") === "1") await forgetDevice(user.sub, id);
  else await revokeDevice(user.sub, id);
  return NextResponse.json({ ok: true });
}
