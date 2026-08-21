import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, sessionsConfigured, signSession } from "@/lib/users/session";
import { toSessionUser, verifyGoogleToken } from "@/lib/users/identity";
import { allowlistConfigured, isAllowed } from "@/lib/users/allowlist";
import { redeemInvite } from "@/lib/users/invites";
import { seenDevice } from "@/lib/users/devices";

export const runtime = "nodejs";

/**
 * Sign in: a Google access token in, a signed session cookie out.
 *
 * Google is asked once, here, who the token belongs to. From then on our own
 * cookie carries the answer, so every later request knows who is asking
 * without a round trip — which is what makes per-person caps and per-person
 * insight possible at all.
 */
export async function POST(request: Request) {
  if (!sessionsConfigured()) {
    return NextResponse.json(
      { error: "Sign-in isn't set up on this deployment yet.", code: "no_auth_secret" },
      { status: 503 },
    );
  }
  if (!(await allowlistConfigured())) {
    // Failing closed on purpose: turning this door on is a deliberate act.
    return NextResponse.json(
      { error: "biblio isn't open yet — ask Shiva.", code: "closed" },
      { status: 403 },
    );
  }

  let body: { token?: unknown; device?: unknown; invite?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; device?: unknown; invite?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.token !== "string") {
    return NextResponse.json({ error: "Missing Google token." }, { status: 400 });
  }

  const profile = await verifyGoogleToken(body.token);
  if (!profile) {
    return NextResponse.json(
      { error: "Google didn't recognise that sign-in. Try again.", code: "bad_token" },
      { status: 401 },
    );
  }
  if (!(await isAllowed(profile.email))) {
    // Someone holding a link walks in without waiting for anyone. It is the
    // link that was shared, so no address had to be known in advance.
    const invite = typeof body.invite === "string" ? body.invite.slice(0, 64) : "";
    const welcomed = invite ? await redeemInvite(invite, profile.email ?? "") : false;
    if (!welcomed) {
      // A warm dead end, not a stack trace.
      return NextResponse.json(
        {
          error: "biblio isn't open to this account yet — you'll need an invitation link.",
          code: "not_allowed",
        },
        { status: 403 },
      );
    }
  }

  const d = body.device as { id?: unknown; label?: unknown; platform?: unknown } | undefined;
  if (d && typeof d.id === "string" && d.id.length <= 64) {
    try {
      await seenDevice(profile.sub, {
        id: d.id,
        label: typeof d.label === "string" ? d.label.slice(0, 60) : "A device",
        platform: typeof d.platform === "string" ? d.platform.slice(0, 60) : "unknown",
      });
    } catch {
      /* the registry is for visibility; never block a sign-in over it */
    }
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(toSessionUser(profile)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return NextResponse.json({ ok: true, profile });
}

/** Sign out this browser. The journal on the device is untouched. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
