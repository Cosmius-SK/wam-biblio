import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users/limits";
import { allowedEmails, ownerEmail, removeAllowed } from "@/lib/users/allowlist";
import { createInvite, listInvites, revokeInvite } from "@/lib/users/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() {
  const user = await currentUser();
  const owner = ownerEmail();
  return !!user && !!owner && user.email?.toLowerCase() === owner;
}

/** Owner-only: who is in, and which links are open. */
export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [invites, allowed] = await Promise.all([listInvites(), allowedEmails()]);
  return NextResponse.json({ invites, allowed });
}

export async function POST(request: Request) {
  if (!(await owner())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as {
    note?: string;
    uses?: number;
    days?: number;
  };
  try {
    return NextResponse.json({ invite: await createInvite(body) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't make a link." },
      { status: 502 },
    );
  }
}

/** Revoke a link, or remove someone who is already in. */
export async function DELETE(request: Request) {
  if (!(await owner())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const email = url.searchParams.get("email");
  try {
    if (id) await revokeInvite(id);
    else if (email) await removeAllowed(email);
    else return NextResponse.json({ error: "Bad request." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "That didn't work." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
