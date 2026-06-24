import { NextResponse } from "next/server";
import { COOKIE_NAME, passcode, isGateConfigured, expectedToken } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/unlock — exchange the passcode for an auth cookie. */
export async function POST(request: Request) {
  let input: unknown;
  try {
    input = ((await request.json()) as { passcode?: unknown }).passcode;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // No passcode configured → nothing to unlock; let them straight in.
  if (!isGateConfigured()) return NextResponse.json({ ok: true });

  if (typeof input !== "string" || input !== passcode()) {
    return NextResponse.json({ error: "That passcode doesn't match." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year
  });
  return res;
}
