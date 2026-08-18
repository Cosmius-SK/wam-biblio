import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, isGateConfigured, expectedToken, safeEqual } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/users/session";

/**
 * Gate every page and API route. Two doors are open at once, deliberately:
 * a signed session cookie (sign in with Google) and the older shared passcode.
 *
 * The new door is never allowed to remove the old one in the same release — if
 * sign-in turns out to be broken in production, nobody can fix it from inside
 * an app the middleware is blocking, including the person who deployed it. See
 * docs/releases.md, "Cutovers".
 *
 * The unlock and welcome screens and their APIs are always public; static
 * assets are excluded via the matcher below. With no passcode configured the
 * gate is off (fail-open), exactly as before.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public paths.
  if (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/api/unlock") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/offline") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Door one: a signed session says who is asking.
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // No passcode set → gate disabled.
  if (!isGateConfigured()) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && safeEqual(token, await expectedToken())) {
    return NextResponse.next();
  }

  // Locked. API calls get a clean 401; pages redirect to the unlock screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked — unlock the journal first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname && pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals, Vercel instrumentation, and static files.
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|icon.svg|sw.js|manifest.webmanifest).*)"],
};
